type HeaderMap = Record<string, unknown>;

function getHeader(headers: HeaderMap | undefined, key: string): string {
    if (!headers) return '';
    const lowerKey = key.toLowerCase();
    const found = Object.entries(headers).find(([k]) => k.toLowerCase() === lowerKey);
    if (!found) return '';

    const value = found[1];
    if (Array.isArray(value)) return value.join(', ');
    if (value == null) return '';
    return String(value);
}

function ensurePdfFilename(filename: string): string {
    const clean = filename.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'report';
    return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

function extractFilename(contentDisposition: string, fallback: string): string {
    if (!contentDisposition) return ensurePdfFilename(fallback);

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
        try {
            return ensurePdfFilename(decodeURIComponent(utf8Match[1].trim().replace(/"/g, '')));
        } catch {
            return ensurePdfFilename(utf8Match[1].trim().replace(/"/g, ''));
        }
    }

    const plainMatch = /filename="?([^\";]+)"?/i.exec(contentDisposition);
    if (plainMatch?.[1]) {
        return ensurePdfFilename(plainMatch[1].trim());
    }

    return ensurePdfFilename(fallback);
}

function hasPdfSignature(bytes: Uint8Array): boolean {
    if (bytes.length < 5) return false;
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // %PDF-
}

export async function downloadPdfFromResponse(
    data: Blob | ArrayBuffer | unknown,
    headers: HeaderMap | undefined,
    fallbackFilename: string,
): Promise<void> {
    const contentDisposition = getHeader(headers, 'content-disposition');
    const filename = extractFilename(contentDisposition, fallbackFilename);

    const sourceBlob = data instanceof Blob
        ? data
        : data instanceof ArrayBuffer
            ? new Blob([data])
            : new Blob([String(data ?? '')]);

    const arrayBuffer = await sourceBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!hasPdfSignature(bytes)) {
        throw new Error('Downloaded file is not a valid PDF. Please regenerate the report and try again.');
    }

    const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    anchor.target = '_blank'; // Guaranteed fallback in some strict environments

    document.body.appendChild(anchor);
    
    // Ensure DOM repaints before firing click so the browser registers the download attribute
    window.requestAnimationFrame(() => {
        anchor.click();
        
        window.setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }, 1500);
    });
}
