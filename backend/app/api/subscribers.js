const express = require('express');
const { sequelize } = require('../core/database');
const { ActivityLog, Subscriber } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const MAX_IMPORT_BYTES = parseInt(process.env.SUBSCRIBER_IMPORT_MAX_BYTES || `${5 * 1024 * 1024}`, 10);

function normalizeHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
    const candidates = [';', ',', '\t'];
    let best = ';';
    let bestCount = -1;

    for (const delimiter of candidates) {
        let count = 0;
        let inQuotes = false;

        for (let i = 0; i < firstLine.length; i++) {
            const ch = firstLine[i];
            if (ch === '"') {
                if (inQuotes && firstLine[i + 1] === '"') i++;
                else inQuotes = !inQuotes;
            } else if (ch === delimiter && !inQuotes) {
                count++;
            }
        }

        if (count > bestCount) {
            best = delimiter;
            bestCount = count;
        }
    }

    return best;
}

function parseDelimitedText(text, delimiter = ';') {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            row.push(cell.trim());
            cell = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            row.push(cell.trim());
            cell = '';
            if (row.some(value => value.length > 0)) rows.push(row);
            row = [];
            if (ch === '\r' && text[i + 1] === '\n') i++;
        } else {
            cell += ch;
        }
    }

    row.push(cell.trim());
    if (row.some(value => value.length > 0)) rows.push(row);

    if (rows[0]?.[0]) {
        rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    }

    return rows;
}

function parseImportDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const parsedAsUtc = new Date(`${normalized}Z`);
    return Number.isNaN(parsedAsUtc.getTime()) ? null : parsedAsUtc;
}

function parseAddressBookCsv(csvText) {
    const delimiter = detectDelimiter(csvText);
    const rows = parseDelimitedText(csvText, delimiter);
    if (rows.length < 2) {
        const error = new Error('Uploaded file does not contain any subscriber rows');
        error.status = 400;
        throw error;
    }

    const headers = rows[0];
    const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
    const emailIndex = headerMap.get('email');

    if (emailIndex === undefined) {
        const error = new Error('Uploaded file must include an email column');
        error.status = 400;
        throw error;
    }

    const emailStatusIndex = headerMap.get('emailstatus');
    const nameIndex = headerMap.get('name');
    const addedIndex = headerMap.get('added');
    const importedAt = new Date();
    const importedByEmail = new Map();
    const skippedRows = [];
    const statusCounts = {};

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;
        const rawEmail = String(row[emailIndex] || '').trim().toLowerCase();

        if (!rawEmail) {
            skippedRows.push({ row: rowNumber, reason: 'missing_email' });
            continue;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
            skippedRows.push({ row: rowNumber, reason: 'invalid_email' });
            continue;
        }

        const emailStatus = emailStatusIndex !== undefined ? String(row[emailStatusIndex] || '').trim() : 'Active';
        const normalizedStatus = emailStatus.toLowerCase();
        const isActive = normalizedStatus === 'active';
        const isUnsubscribed = normalizedStatus.includes('unsubscribe');
        const name = nameIndex !== undefined ? String(row[nameIndex] || '').trim() : '';
        const addedAt = addedIndex !== undefined ? parseImportDate(row[addedIndex]) : null;

        statusCounts[emailStatus || 'Unspecified'] = (statusCounts[emailStatus || 'Unspecified'] || 0) + 1;
        importedByEmail.set(rawEmail, {
            email: rawEmail,
            name: name || null,
            isActive,
            subscribedAt: addedAt,
            unsubscribedAt: isUnsubscribed ? importedAt : null,
        });
    }

    return {
        delimiter,
        headers,
        rows: [...importedByEmail.values()],
        duplicateRows: Math.max(0, rows.length - 1 - skippedRows.length - importedByEmail.size),
        skippedRows,
        statusCounts,
        importedAt,
    };
}

function readRequestBuffer(req) {
    if (req.readableEnded) return Promise.resolve(Buffer.alloc(0));

    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;

        req.on('data', chunk => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_IMPORT_BYTES) {
                const error = new Error(`Uploaded file is too large. Maximum size is ${MAX_IMPORT_BYTES} bytes`);
                error.status = 413;
                req.destroy(error);
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function getMultipartBoundary(contentType) {
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
    return match ? (match[1] || match[2]) : null;
}

function extractMultipartFile(buffer, contentType) {
    const boundary = getMultipartBoundary(contentType);
    if (!boundary) {
        const error = new Error('Multipart upload is missing a boundary');
        error.status = 400;
        throw error;
    }

    const body = buffer.toString('utf8');
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const rawHeaders = part.slice(0, headerEnd);
        let content = part.slice(headerEnd + 4);
        content = content.replace(/\r\n$/, '');

        const disposition = rawHeaders.match(/content-disposition:[^\r\n]+/i)?.[0] || '';
        const fieldName = disposition.match(/name="([^"]+)"/i)?.[1] || '';
        const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || '';
        const isFileField = filename || ['file', 'csv', 'subscribers'].includes(fieldName.toLowerCase());

        if (isFileField && content.trim()) {
            return content;
        }
    }

    const error = new Error('Upload must include a CSV file field named "file"');
    error.status = 400;
    throw error;
}

async function readUploadedCsv(req) {
    if (req.body && typeof req.body.csv === 'string') {
        return req.body.csv;
    }

    if (req.body && typeof req.body.data === 'string') {
        return req.body.data;
    }

    if (req.body && Object.keys(req.body).length > 0) {
        const error = new Error('JSON uploads must include a string field named "csv" or "data"');
        error.status = 400;
        throw error;
    }

    const contentType = req.headers['content-type'] || '';
    const buffer = await readRequestBuffer(req);
    if (!buffer.length) {
        const error = new Error('Upload a CSV file using multipart field "file", raw text/csv, or JSON field "csv"');
        error.status = 400;
        throw error;
    }

    if (/multipart\/form-data/i.test(contentType)) {
        return extractMultipartFile(buffer, contentType);
    }

    return buffer.toString('utf8');
}

// GET /api/subscribers
router.get('/', authenticate, authorize('admin', 'analyst', 'super_admin'), async (req, res, next) => {
    try {
        const subscribers = await Subscriber.findAll({
            where: { tenant_id: req.tenantId },
            order: [['subscribed_at', 'DESC']],
        });
        res.json(subscribers);
    } catch (error) {
        next(error);
    }
});

// POST /api/subscribers
router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const [subscriber, created] = await Subscriber.findOrCreate({
            where: { tenant_id: req.tenantId, email: email.toLowerCase() },
            defaults: { name, tenant_id: req.tenantId, is_active: true },
        });

        if (!created) {
            await subscriber.update({ is_active: true, name: name || subscriber.name, unsubscribed_at: null });
        }

        res.status(created ? 201 : 200).json(subscriber);
    } catch (error) {
        next(error);
    }
});

// POST /api/subscribers/bulk - Bulk import
router.post('/bulk', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { subscribers } = req.body; // [{email, name}]
        if (!Array.isArray(subscribers)) return res.status(400).json({ error: 'subscribers must be an array' });

        let added = 0, updated = 0;
        for (const sub of subscribers) {
            if (!sub.email) continue;
            const [record, created] = await Subscriber.findOrCreate({
                where: { tenant_id: req.tenantId, email: sub.email.toLowerCase() },
                defaults: { name: sub.name, tenant_id: req.tenantId, is_active: true },
            });
            if (!created) {
                await record.update({ is_active: true });
                updated++;
            } else {
                added++;
            }
        }

        res.json({ message: `Added ${added}, updated ${updated} subscribers` });
    } catch (error) {
        next(error);
    }
});

// POST /api/subscribers/import-address-book - Import uploaded address-book CSV
router.post('/import-address-book', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const csvText = await readUploadedCsv(req);
        const parsed = parseAddressBookCsv(csvText);

        let added = 0;
        let updated = 0;
        let active = 0;
        let inactive = 0;

        await sequelize.transaction(async (transaction) => {
            for (const row of parsed.rows) {
                if (row.isActive) active++;
                else inactive++;

                const [record, created] = await Subscriber.findOrCreate({
                    where: { tenant_id: req.tenantId, email: row.email },
                    defaults: {
                        tenant_id: req.tenantId,
                        email: row.email,
                        name: row.name,
                        is_active: row.isActive,
                        subscribed_at: row.subscribedAt || parsed.importedAt,
                        unsubscribed_at: row.unsubscribedAt,
                    },
                    transaction,
                });

                if (created) {
                    added++;
                } else {
                    await record.update({
                        name: row.name || record.name,
                        is_active: row.isActive,
                        subscribed_at: row.subscribedAt || record.subscribed_at,
                        unsubscribed_at: row.isActive ? null : (row.unsubscribedAt || record.unsubscribed_at),
                    }, { transaction });
                    updated++;
                }
            }

            await ActivityLog.create({
                tenant_id: req.tenantId,
                user_id: req.user.id,
                action: 'subscribers_import_address_book',
                entity_type: 'subscriber',
                details: {
                    totalRows: parsed.rows.length + parsed.skippedRows.length + parsed.duplicateRows,
                    importedRows: parsed.rows.length,
                    added,
                    updated,
                    active,
                    inactive,
                    skipped: parsed.skippedRows.length,
                    duplicateRows: parsed.duplicateRows,
                    statusCounts: parsed.statusCounts,
                    delimiter: parsed.delimiter === '\t' ? 'tab' : parsed.delimiter,
                    headers: parsed.headers,
                },
                ip_address: req.ip,
            }, { transaction });
        });

        res.json({
            message: `Imported ${parsed.rows.length} subscribers`,
            added,
            updated,
            active,
            inactive,
            skipped: parsed.skippedRows.length,
            duplicateRows: parsed.duplicateRows,
            statusCounts: parsed.statusCounts,
            skippedRows: parsed.skippedRows.slice(0, 25),
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/subscribers/:id
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const sub = await Subscriber.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!sub) return res.status(404).json({ error: 'Subscriber not found' });

        const { name, isActive } = req.body;
        await sub.update({
            ...(name !== undefined && { name }),
            ...(isActive !== undefined && {
                is_active: isActive,
                unsubscribed_at: !isActive ? new Date() : null,
            }),
        });
        res.json(sub);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/subscribers/:id
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res, next) => {
    try {
        const sub = await Subscriber.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
        if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
        await sub.destroy();
        res.json({ message: 'Subscriber removed' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
