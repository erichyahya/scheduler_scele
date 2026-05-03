let _currentController = new AbortController();

function startFetchSession() {
    _currentController.abort();
    _currentController = new AbortController();
    return _currentController.signal;
}

async function fetchText(path) {
    const url = path.startsWith('http')
        ? path
        : 'https://scele.cs.ui.ac.id' + path;
    const res = await fetch(url, {
        credentials: 'include',
        signal: _currentController.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return await res.text();
}
