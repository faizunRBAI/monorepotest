// Shared blob-download helper for the PDF endpoints.
//
// The PDFs are fetched through axios rather than a plain <a href> for two reasons: the
// admin endpoints need the Authorization header, and a failure should surface as a message
// instead of a blank tab. That means the browser's own "save as" naming does not apply, so
// the server's Content-Disposition filename is parsed and reapplied here.

// Reads `filename*=UTF-8''...` first (it carries non-Latin names such as Bangla), then
// falls back to a plain `filename="..."`.
export const filenameFromDisposition = (disposition) => {
    if (!disposition) return null;

    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (utf8) {
        try { return decodeURIComponent(utf8[1].trim()); } catch { /* fall through */ }
    }

    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1].trim() : null;
};

// Saves an axios response (responseType: 'blob') to disk. `fallbackName` is used when the
// server did not supply a usable Content-Disposition — e.g. if the header is not exposed.
// The blob keeps the response's own content type, so this serves CSV as well as PDF.
export const saveBlobResponse = (res, fallbackName) => {
    const name = filenameFromDisposition(res.headers?.['content-disposition']) || fallbackName;
    const type = res.headers?.['content-type'] || 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([res.data], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return name;
};

// Mirrors orderPdfFileName in server/utils/pdf.js, for the fallback path only.
export const orderPdfFileName = (customerName, orderId, variant) => {
    const name = String(customerName || 'Customer')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || 'Customer';
    return `${name}_${orderId}_${variant}.pdf`;
};
