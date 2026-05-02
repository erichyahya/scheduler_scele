function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

function cleanText(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
    return escapeHtml(s);
}

function shortenCourse(name) {
    return name
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/\s*\([A-Z,\s]+\)\s*/, ' ')
        .replace(/Genap \d{4}\/\d{4}/, '')
        .replace(/Ganjil \d{4}\/\d{4}/, '')
        .trim();
}
