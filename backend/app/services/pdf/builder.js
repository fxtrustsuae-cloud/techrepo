const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { format } = require('date-fns');
const logger = require('../../core/logger');

const REPORTS_DIR = process.env.REPORTS_DIR || './reports';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeCssClass(value, fallback = '') {
    const cls = String(value ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return cls || fallback;
}

function sanitizeHexColor(value, fallback = '#1a56db') {
    const color = String(value ?? '').trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
}

/**
 * Master report builder - orchestrates the full PDF generation
 */
async function buildPDFReport(tenant, reportDate, analysisResults) {
    try {
        const dateStr = format(new Date(reportDate), 'dd_MM_yyyy');
        const filename = `Technical_Analysis_Report_${dateStr}.pdf`;
        const reportDir = path.join(REPORTS_DIR, tenant.id);

        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const filepath = path.join(reportDir, filename);
        const html = buildReportHTML(tenant, reportDate, analysisResults);

        // Write HTML for debugging
        const htmlPath = filepath.replace('.pdf', '.html');
        fs.writeFileSync(htmlPath, html);

        // Launch puppeteer
        const browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('screen');
        await page.evaluateHandle('document.fonts.ready');

        await page.pdf({
            path: filepath,
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            displayHeaderFooter: false,
        });

        await browser.close();
        logger.info(`PDF generated: ${filename}`);
        return { filepath, filename };
    } catch (error) {
        logger.error(`PDF generation failed: ${error.message}`);
        throw error;
    }
}

async function launchBrowser() {
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
        ],
    };

    // Try common chromium paths
    const chromiumPaths = [
        process.env.CHROMIUM_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ].filter(Boolean);

    for (const execPath of chromiumPaths) {
        if (fs.existsSync(execPath)) {
            return await puppeteer.launch({ ...launchOptions, executablePath: execPath });
        }
    }

    // Try @sparticuz/chromium
    try {
        const chromium = require('@sparticuz/chromium');
        return await puppeteer.launch({
            ...launchOptions,
            executablePath: await chromium.executablePath(),
        });
    } catch (e) {
        throw new Error('No Chromium installation found. Set CHROMIUM_PATH in .env or install Google Chrome.');
    }
}

function buildReportHTML(tenant, reportDate, analysisResults) {
    const dateFormatted = format(new Date(reportDate), 'MMMM dd, yyyy');
    const primaryColor = sanitizeHexColor(tenant.branding_primary_color || '#1a56db');
    const companyName = tenant.branding_company_name || tenant.name || 'TechAnalysis Pro';
    const companyEmail = tenant.branding_email || process.env.COMPANY_EMAIL || '';
    const companyWebsite = tenant.branding_website || process.env.COMPANY_WEBSITE || '';
    const footerText = tenant.branding_footer_text || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Technical Analysis Report — ${dateFormatted}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #f8f9fa;
    color: #1a202c;
    font-size: 9pt;
    line-height: 1.5;
  }

  /* ── Cover Page ─────────────────────────────────── */
  .cover-page {
    width: 210mm;
    min-height: 297mm;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 50px;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }

  .cover-page::before {
    content: '';
    position: absolute;
    top: -100px;
    right: -100px;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, ${primaryColor}30 0%, transparent 70%);
    border-radius: 50%;
  }

  .cover-page::after {
    content: '';
    position: absolute;
    bottom: -80px;
    left: -80px;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, ${primaryColor}20 0%, transparent 70%);
    border-radius: 50%;
  }

  .cover-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 22px;
    font-weight: 800;
  }

  .logo-text {
    color: white;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .logo-text span { color: ${primaryColor}; }

  .cover-center {
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .cover-badge {
    display: inline-block;
    background: ${primaryColor}30;
    border: 1px solid ${primaryColor}60;
    color: ${primaryColor};
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 20px;
  }

  .cover-title {
    font-size: 36pt;
    font-weight: 800;
    color: white;
    line-height: 1.1;
    margin-bottom: 12px;
    letter-spacing: -1px;
  }

  .cover-title span { color: ${primaryColor}; }

  .cover-subtitle {
    font-size: 13pt;
    color: rgba(255,255,255,0.6);
    margin-bottom: 30px;
    font-weight: 400;
  }

  .cover-date {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    display: inline-block;
    padding: 10px 28px;
    border-radius: 8px;
    color: white;
    font-size: 11pt;
    font-weight: 600;
  }

  .cover-assets {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 24px;
  }

  .asset-tag {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.8);
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 8pt;
    font-weight: 600;
  }

  .cover-footer {
    color: rgba(255,255,255,0.4);
    font-size: 7.5pt;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 20px;
  }

  /* ── Report Pages ───────────────────────────────── */
  .report-page {
    width: 210mm;
    min-height: 297mm;
    background: #ffffff;
    padding: 0;
    page-break-after: always;
    position: relative;
  }

  .page-header {
    background: linear-gradient(135deg, #0f172a, #1e293b);
    padding: 16px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-header-logo {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa);
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: 800;
  }

  .page-header-company {
    color: white;
    font-size: 10pt;
    font-weight: 700;
  }

  .page-header-right {
    text-align: right;
    color: rgba(255,255,255,0.6);
    font-size: 7.5pt;
  }

  .page-header-right .date { color: ${primaryColor}; font-weight: 600; }

  .page-content { padding: 20px 28px 80px; }

  /* ── Asset Analysis Section ─────────────────────── */
  .asset-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 2px solid #f1f5f9;
  }

  .asset-icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11pt;
    font-weight: 800;
    color: white;
    flex-shrink: 0;
  }

  .asset-icon.forex { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  .asset-icon.gold { background: linear-gradient(135deg, #f59e0b, #b45309); }
  .asset-icon.indices { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
  .asset-icon.crypto { background: linear-gradient(135deg, #f97316, #c2410c); }

  .asset-title-block { flex: 1; }
  .asset-symbol { font-size: 20pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .asset-name { font-size: 9pt; color: #64748b; margin-top: 1px; }
  
  .asset-price-block { text-align: right; }
  .asset-price { font-size: 16pt; font-weight: 700; color: #0f172a; }
  .asset-change { font-size: 9pt; font-weight: 600; padding: 2px 8px; border-radius: 5px; margin-top: 2px; display: inline-block; }
  .asset-change.up { background: #dcfce7; color: #16a34a; }
  .asset-change.down { background: #fee2e2; color: #dc2626; }

  .bias-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 700;
    margin-right: 8px;
  }

  .bias-badge.bullish { background: #dcfce7; color: #15803d; }
  .bias-badge.bearish { background: #fee2e2; color: #b91c1c; }
  .bias-badge.neutral { background: #f1f5f9; color: #475569; }

  .confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 600;
    background: #eff6ff;
    color: #1d4ed8;
  }

  /* ── Data Quick-Stats ───────────────────────────── */
  .quick-stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 18px;
    background: #f8fafc;
    border-radius: 10px;
    padding: 12px;
  }

  .stat-item { text-align: center; }
  .stat-label { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .stat-value { font-size: 10pt; font-weight: 700; color: #0f172a; }
  .stat-value.positive { color: #16a34a; }
  .stat-value.negative { color: #dc2626; }
  .stat-value.neutral-color { color: #f59e0b; }

  /* ── Chart Image ────────────────────────────────── */
  .chart-container {
    background: #0d1117;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 18px;
    border: 1px solid #1e293b;
  }

  .chart-container img {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-placeholder {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.3);
    font-size: 9pt;
  }

  /* Pivot report layout matching provided sample */
  .pivot-page { background: #eef0f3; }
  .pivot-page .page-content { padding: 16px 24px 26px; }
  .pivot-page .page-footer { display: none; }

  .pivot-header {
    display: grid;
    grid-template-columns: 220px 1fr;
    margin: 0 24px 14px;
    border: 1px solid #164872;
    border-bottom: 0;
  }

  .pivot-header-left {
    background: #2570ad;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34px;
    font-weight: 800;
    min-height: 88px;
  }

  .pivot-header-right {
    background: #123f63;
    color: #fff;
    text-align: center;
    font-weight: 700;
    font-size: 24pt;
    line-height: 1.2;
    padding-top: 14px;
    position: relative;
  }

  .pivot-header-right::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 10px;
    background: linear-gradient(90deg, #5de5f5 0%, #25c4ea 33%, #37d6f3 66%, #5de5f5 100%);
  }

  .pivot-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 2px;
    align-items: stretch;
    margin-bottom: 16px;
  }

  .pivot-panel {
    border: 1px solid #3d4f5a;
    background: #f7f8fa;
  }

  .pivot-head {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .pivot-symbol,
  .pivot-trend {
    padding: 13px 8px;
    text-align: center;
    font-size: 14pt;
    font-weight: 800;
    border-bottom: 1px solid #3d4f5a;
  }

  .pivot-symbol { border-right: 1px solid #3d4f5a; }
  .pivot-trend { font-size: 13pt; }

  .pivot-title {
    background: #2570ad;
    color: #fff;
    text-align: center;
    font-weight: 700;
    font-size: 12pt;
    padding: 6px;
    border-bottom: 1px solid #3d4f5a;
  }

  .pivot-pp {
    text-align: center;
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    padding: 10px 8px;
    border-bottom: 1px solid #3d4f5a;
    background: #fff;
  }

  .pivot-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .pivot-table thead th {
    background: #2570ad;
    color: #fff;
    font-size: 10.5pt;
    font-weight: 700;
    padding: 6px;
    border: 1px solid #3d4f5a;
  }

  .pivot-table td {
    padding: 10px 8px;
    font-size: 12pt;
    border: 1px solid #3d4f5a;
    background: #fff;
    font-weight: 500;
  }

  .pivot-plan-tag {
    background: #2570ad;
    color: #fff;
    text-align: center;
    font-weight: 700;
    font-size: 12pt;
    padding: 10px;
    border-top: 1px solid #3d4f5a;
  }

  .pivot-chart {
    border: 1px solid #3d4f5a;
    background: #f4f6f8;
    position: relative;
  }

  .pivot-chart-title {
    font-size: 15pt;
    font-weight: 700;
    color: #111827;
    padding: 8px 10px;
    border-bottom: 1px solid #aab4bd;
  }

  .pivot-chart .chart-container {
    margin: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    min-height: 365px;
  }

  .pivot-chart .chart-placeholder {
    min-height: 365px;
    background: #edf0f4;
    color: #64748b;
  }

  .pivot-chart .chart-container img {
    width: 100%;
    height: 365px;
    object-fit: cover;
  }

  .pivot-plans {
    border-top: 1px solid #94a3b8;
    border-bottom: 1px solid #94a3b8;
    margin: 10px 0 12px;
  }

  .pivot-plan-line {
    padding: 10px 4px;
    font-size: 20pt;
    font-weight: 800;
    color: #111827;
    border-bottom: 1px solid #cbd5e1;
  }

  .pivot-plan-line:last-child { border-bottom: 0; }

  .pivot-disclaimer {
    font-size: 8pt;
    color: #111827;
    line-height: 1.5;
    border-top: 0;
    padding-top: 4px;
  }

  /* ── Analysis Sections ──────────────────────────── */
  .analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 16px;
  }

  .analysis-section {
    background: #f8fafc;
    border-radius: 8px;
    padding: 13px;
    border: 1px solid #e2e8f0;
  }

  .analysis-section.full-width {
    grid-column: 1 / -1;
  }

  .section-title {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${primaryColor};
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .section-title::before {
    content: '';
    width: 3px;
    height: 12px;
    background: ${primaryColor};
    border-radius: 2px;
    display: inline-block;
  }

  .section-body {
    color: #374151;
    font-size: 8pt;
    line-height: 1.55;
  }

  /* ── Key Levels Table ───────────────────────────── */
  .levels-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }

  .level-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }

  .level-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 4px;
    font-weight: 600;
  }

  .level-value {
    font-size: 10pt;
    font-weight: 700;
  }

  .level-value.support { color: #16a34a; }
  .level-value.resistance { color: #dc2626; }
  .level-value.entry { color: #1d4ed8; }
  .level-value.sl { color: #dc2626; }
  .level-value.tp { color: #16a34a; }

  /* ── Indicator Summary Bar ──────────────────────── */
  .indicator-bars {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .indicator-bar {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }

  .indicator-name { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .indicator-val { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
  .indicator-signal {
    font-size: 7pt;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    margin-top: 3px;
    display: inline-block;
  }
  .sig-bull { background: #dcfce7; color: #15803d; }
  .sig-bear { background: #fee2e2; color: #b91c1c; }
  .sig-neu { background: #f1f5f9; color: #475569; }

  /* ── Disclaimer ─────────────────────────────────── */
  .disclaimer {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 8px;
    padding: 12px;
    margin-top: 14px;
  }

  .disclaimer-title {
    font-size: 7pt;
    font-weight: 700;
    color: #9a3412;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 5px;
  }

  .disclaimer-text {
    font-size: 7pt;
    color: #7c2d12;
    line-height: 1.6;
  }

  /* ── Page Footer ─────────────────────────────────── */
  .page-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 10px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7pt;
    color: #94a3b8;
  }

  /* ── Market Summary Table ───────────────────────── */
  .summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    font-size: 8pt;
  }

  .summary-table th {
    background: #0f172a;
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .summary-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  .summary-table tr:nth-child(even) td { background: #f8fafc; }
  .summary-table tr:hover td { background: #eff6ff; }

  .badge-bull { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 10px; font-size: 7pt; font-weight: 700; }
  .badge-bear { background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 10px; font-size: 7pt; font-weight: 700; }
  .badge-neu { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 10px; font-size: 7pt; font-weight: 700; }

  /* ── Print styles ───────────────────────────────── */
  @media print {
    .report-page, .cover-page { page-break-after: always; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ══════════════════ COVER PAGE ══════════════════ -->
<div class="cover-page">
  <div class="cover-logo">
    <div class="logo-icon">T</div>
    <div class="logo-text">${companyName.split(' ').map((w, i) => i === 0 ? `<span>${escapeHtml(w)}</span>` : escapeHtml(w)).join(' ')}</div>
  </div>

  <div class="cover-center">
    <div class="cover-badge">📊 Daily Technical Report</div>
    <div class="cover-title">Technical<br><span>Analysis</span><br>Report</div>
    <div class="cover-subtitle">Professional Market Intelligence</div>
    <div class="cover-date">📅 ${dateFormatted}</div>
    
    <div class="cover-assets">
      ${analysisResults.map(r => `<div class="asset-tag">${escapeHtml(r.symbol)}</div>`).join('')}
    </div>
  </div>

  <div class="cover-footer">
    <div>${escapeHtml(companyName)} | ${escapeHtml(companyEmail)} | ${escapeHtml(companyWebsite)}</div>
    <div style="margin-top:6px">This report is for informational purposes only. Not financial advice.</div>
  </div>
</div>

<!-- ══════════════════ MARKET SUMMARY PAGE ══════════════════ -->
<div class="report-page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">T</div>
      <div class="page-header-company">${escapeHtml(companyName)}</div>
    </div>
    <div class="page-header-right">
      Daily Technical Analysis Report<br>
      <span class="date">${dateFormatted}</span>
    </div>
  </div>
  <div class="page-content">
    <div class="section-title" style="font-size:11pt;margin-bottom:16px;color:#0f172a">📋 Market Summary Overview</div>
    
    <table class="summary-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>Category</th>
          <th>Price</th>
          <th>Pivot (PP)</th>
          <th>Bias</th>
          <th>Buy Plan</th>
          <th>Sell Plan</th>
        </tr>
      </thead>
      <tbody>
        ${analysisResults.map(r => `
          <tr>
            <td><strong>${escapeHtml(r.symbol)}</strong></td>
            <td>${escapeHtml(r.name)}</td>
            <td style="text-transform:capitalize">${escapeHtml(r.category)}</td>
            <td><strong>${r.indicators?.price?.current?.toFixed(5) || 'N/A'}</strong></td>
            <td><strong>${r.indicators?.pivotPoints?.pp?.toFixed(5) || 'N/A'}</strong></td>
            <td>
              <span class="${r.commentary?.tradeBias === 'Bullish' ? 'badge-bull' : r.commentary?.tradeBias === 'Bearish' ? 'badge-bear' : 'badge-neu'}">
                ${escapeHtml(r.commentary?.tradeBias || 'Neutral')}
              </span>
            </td>
            <td><strong>${r.indicators?.pivotPoints ? `Above ${r.indicators.pivotPoints.pp.toFixed(5)} → ${r.indicators.pivotPoints.r1.toFixed(5)} / ${r.indicators.pivotPoints.r2.toFixed(5)} | SL ${r.indicators.pivotPoints.s1.toFixed(5)}` : 'N/A'}</strong></td>
            <td><strong>${r.indicators?.pivotPoints ? `Below ${r.indicators.pivotPoints.pp.toFixed(5)} → ${r.indicators.pivotPoints.s1.toFixed(5)} / ${r.indicators.pivotPoints.s2.toFixed(5)} | SL ${r.indicators.pivotPoints.r1.toFixed(5)}` : 'N/A'}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="analysis-section" style="margin-bottom:14px;">
      <div class="section-title">Market Session Notes</div>
      <div class="section-body">
        This report covers ${analysisResults.length} actively monitored instruments across ${escapeHtml([...new Set(analysisResults.map(r => r.category))].join(', '))} markets.
        Analysis is pivot-only using Classic Pivot Point levels from the previous daily candle.
        All levels and commentary are generated as of ${dateFormatted} using PP / R1-R3 / S1-S3.
        Trading plans are provided as directional scenarios above/below PP with defined target and stop zones.
      </div>
    </div>
  </div>
  <div class="page-footer">
    <span>${escapeHtml(companyName)} — Confidential</span>
    <span>${dateFormatted}</span>
    <span>${escapeHtml(companyWebsite)}</span>
  </div>
</div>

<!-- ══════════════════ INDIVIDUAL ASSET PAGES ══════════════════ -->
${analysisResults.map((result, idx) => buildAssetPage(result, tenant, dateFormatted, primaryColor, companyName, companyWebsite, idx + 3)).join('')}

</body>
</html>
`;
}

function buildAssetPage(result, tenant, dateFormatted, primaryColor, companyName, companyWebsite, pageNum) {
    const { symbol, name, category, indicators, commentary, chartPath } = result;
    const price = indicators?.price;
    const pp = indicators?.pivotPoints?.pp;
    const r1 = indicators?.pivotPoints?.r1;
    const r2 = indicators?.pivotPoints?.r2;
    const r3 = indicators?.pivotPoints?.r3;
    const s1 = indicators?.pivotPoints?.s1;
    const s2 = indicators?.pivotPoints?.s2;
    const s3 = indicators?.pivotPoints?.s3;
    const categoryClass = sanitizeCssClass(category, 'forex');
    const trendArrow = commentary?.tradeBias === 'Bullish' ? '↑' : commentary?.tradeBias === 'Bearish' ? '↓' : '↔';
    const buyPlan = pp && r1 && r2 && s1
        ? `Buy Above ${pp.toFixed(4)} and Target ${r1.toFixed(4)} then ${r2.toFixed(4)} with the stop loss of ${s1.toFixed(4)}`
        : 'Buy plan unavailable';
    const sellPlan = pp && s1 && s2 && r1
        ? `Sell Below ${pp.toFixed(4)} and Target ${s1.toFixed(4)} then ${s2.toFixed(4)} with the stop loss of ${r1.toFixed(4)}`
        : 'Sell plan unavailable';

    // Encode chart image as base64 if available
    let chartImg = '';
    const fs = require('fs');
    if (chartPath && fs.existsSync(chartPath)) {
        const imgBuffer = fs.readFileSync(chartPath);
        const b64 = imgBuffer.toString('base64');
        chartImg = `<img src="data:image/png;base64,${b64}" alt="${escapeHtml(symbol)} chart" />`;
    } else {
        chartImg = `<div class="chart-placeholder">Chart not available</div>`;
    }

    return `
<div class="report-page pivot-page">
  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">T</div>
      <div class="page-header-company">${escapeHtml(companyName)}</div>
    </div>
    <div class="page-header-right">
      ${escapeHtml(symbol)} — Technical Analysis<br>
      <span class="date">${dateFormatted}</span>
    </div>
  </div>

  <div class="page-content">
    <div class="pivot-layout">
      <div class="pivot-panel">
        <div class="pivot-head">
          <div class="pivot-symbol">${escapeHtml(symbol)}</div>
          <div class="pivot-trend">TREND: ${trendArrow}</div>
        </div>
        <div class="pivot-title">Pivot Point</div>
        <div class="pivot-pp">${pp?.toFixed(4) || 'N/A'}</div>
        <table class="pivot-table">
          <thead><tr><th>Support</th><th>Resistance</th></tr></thead>
          <tbody>
            <tr><td>S1 : ${s1?.toFixed(4) || 'N/A'}</td><td>R1 : ${r1?.toFixed(4) || 'N/A'}</td></tr>
            <tr><td>S2 : ${s2?.toFixed(4) || 'N/A'}</td><td>R2 : ${r2?.toFixed(4) || 'N/A'}</td></tr>
            <tr><td>S3 : ${s3?.toFixed(4) || 'N/A'}</td><td>R3 : ${r3?.toFixed(4) || 'N/A'}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pivot-chart">
        <div class="pivot-chart-title">${escapeHtml(symbol)}, ${escapeHtml(name)}</div>
        <div class="chart-container">${chartImg}</div>
      </div>
    </div>

    <div class="pivot-plans">
      <div class="pivot-plan-line">» ${escapeHtml(buyPlan)}</div>
      <div class="pivot-plan-line">» ${escapeHtml(sellPlan)}</div>
    </div>

    <div class="disclaimer">
      <div class="disclaimer-title">⚠️ Risk Disclaimer</div>
      <div class="disclaimer-text">${escapeHtml(commentary?.riskDisclaimer || '')}</div>
    </div>
  </div>

  <div class="page-footer">
    <span>${escapeHtml(companyName)} — Confidential Report</span>
    <span>Page ${pageNum}</span>
    <span>${escapeHtml(companyWebsite)}</span>
  </div>
</div>
`;
}

module.exports = { buildPDFReport };
