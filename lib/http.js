async function fetchText(path) {
    const url = path.startsWith('http')
        ? path
        : 'https://scele.cs.ui.ac.id' + path;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return await res.text();
}
