async function fetchText(path) {
    const url = path.startsWith('http')
        ? path
        : 'https://scele.cs.ui.ac.id' + path;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return await res.text();
}

function detectStatus(html, type) {
    const text = html.toLowerCase();
    if (type === 'Assignment') {
        if (
            text.includes('submitted for grading') ||
            text.includes('submitted, for grading') ||
            text.includes('submission status: submitted')
        )
            return 'done';
        if (
            text.includes('no attempt') ||
            text.includes('nothing has been submitted') ||
            text.includes('no submissions have been made yet')
        )
            return 'notdone';
        if (text.includes('graded')) return 'done';
        return 'notdone';
    } else {
        if (
            text.includes('your previous attempts') ||
            text.includes('summary of your previous attempts') ||
            text.includes('highest grade:')
        )
            return 'done';
        if (
            text.includes('no attempts have been made on this quiz') ||
            text.includes('attempts allowed:')
        ) {
            if (text.includes('state</th>') && text.includes('finished'))
                return 'done';
            return 'notdone';
        }
        return 'notdone';
    }
}

async function enrichStatus(items, onUpdate) {
    const concurrency = 4;
    let idx = 0;
    async function worker() {
        while (idx < items.length) {
            const i = idx++;
            const item = items[i];
            try {
                const html = await fetchText(
                    item.type === 'Assignment'
                        ? `/mod/assign/view.php?id=${item.id}`
                        : `/mod/quiz/view.php?id=${item.id}`
                );
                item.status = detectStatus(html, item.type);
            } catch {
                item.status = 'unknown';
            }
            if (onUpdate) onUpdate(item);
        }
    }
    const workers = [];
    for (let k = 0; k < concurrency; k++) workers.push(worker());
    await Promise.all(workers);
}

function detectUserReplied(html, userId) {
    const re = new RegExp(`/user/view\\.php\\?id=${userId}(?:&|"|\\s|>|$)`, 'g');
    const matches = html.match(re);
    if (!matches) return false;
    return matches.length >= 2;
}

let _currentUserId = null;
async function getCurrentUserId() {
    if (_currentUserId) return _currentUserId;
    try {
        const html = await fetchText('/');
        const m = html.match(/\/user\/profile\.php\?id=(\d+)/);
        if (m) {
            _currentUserId = m[1];
            return _currentUserId;
        }
        const m2 = html.match(/"userid"\s*:\s*(\d+)/);
        if (m2) {
            _currentUserId = m2[1];
            return _currentUserId;
        }
    } catch {}
    return null;
}
