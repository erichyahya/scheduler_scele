function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

function cleanText(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
}

function parseCourses(html) {
    const doc = parseHtml(html);
    const links = doc.querySelectorAll(
        '.block_navigation a[href*="/course/view.php?id="], .block_settings a[href*="/course/view.php?id="]'
    );
    const seen = new Set();
    const result = [];
    for (const a of links) {
        const m = a.href.match(/[?&]id=(\d+)/);
        if (!m) continue;
        const id = m[1];
        if (seen.has(id)) continue;
        const li = a.closest('li');
        if (!li || !li.className.includes('type_course')) continue;
        seen.add(id);
        const title = a.getAttribute('title') || a.textContent.trim();
        result.push({ id, title: cleanText(title) });
    }
    return result;
}

function parseActivities(html, course) {
    const doc = parseHtml(html);
    const items = [];
    const lis = doc.querySelectorAll('li.activity.assign, li.activity.quiz');
    for (const li of lis) {
        const isAssign = li.classList.contains('assign');
        const type = isAssign ? 'Assignment' : 'Quiz';
        const link = li.querySelector('a.aalink');
        if (!link) continue;
        const url = link.href;
        const idMatch = url.match(/[?&]id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;
        const nameSpan = li.querySelector('.instancename');
        let name = '';
        if (nameSpan) {
            const clone = nameSpan.cloneNode(true);
            clone.querySelectorAll('.accesshide').forEach((e) => e.remove());
            name = cleanText(clone.textContent);
        }

        let dueText = '';
        let closedText = '';
        const dateRegion = li.querySelector('[data-region="activity-dates"]');
        if (dateRegion) {
            const divs = dateRegion.querySelectorAll('div');
            for (const d of divs) {
                const txt = d.textContent.trim();
                if (txt.startsWith('Due:')) {
                    dueText = txt.replace(/^Due:\s*/, '').trim();
                } else if (txt.startsWith('Closed:')) {
                    closedText = txt.replace(/^Closed:\s*/, '').trim();
                }
            }
        }

        const deadline = dueText || closedText;
        const deadlineLabel = dueText ? 'Due' : closedText ? 'Closes' : '';
        const deadlineMs = deadline ? parseMoodleDate(deadline) : null;

        items.push({
            id,
            type,
            name,
            url,
            course: course.title,
            courseId: course.id,
            deadline,
            deadlineLabel,
            deadlineMs,
            status: 'loading',
        });
    }
    return items;
}

function parseGeneralForums(html) {
    return parseForumsByCategory(html, 'general');
}

function parseLearningForums(html) {
    return parseForumsByCategory(html, 'learning');
}

function parseForumsByCategory(html, category) {
    const doc = parseHtml(html);
    const result = [];
    const headings = doc.querySelectorAll('h2');
    for (const h of headings) {
        const text = h.textContent.trim().toLowerCase();
        const matches = category === 'general'
            ? (text === 'general forums' || text.includes('general forum'))
            : (text === 'learning forums' || text.includes('learning forum'));
        if (matches) {
            let el = h.nextElementSibling;
            while (el && el.tagName !== 'TABLE') el = el.nextElementSibling;
            if (!el) continue;
            const links = el.querySelectorAll('a[href*="view.php?f="]');
            const seen = new Set();
            for (const a of links) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/[?&]f=(\d+)/);
                if (!m) continue;
                const fid = m[1];
                if (seen.has(fid)) continue;
                const name = cleanText(a.textContent);
                if (!name) continue;
                seen.add(fid);
                result.push({ forumId: fid, forumName: name });
            }
        }
    }
    return result;
}

function parseForumDiscussions(html) {
    const doc = parseHtml(html);
    const result = [];
    const topicLinks = doc.querySelectorAll('a.w-100.h-100.d-block[href*="discuss.php?d="]');
    for (const a of topicLinks) {
        const rawHref = a.getAttribute('href') || '';
        const url = rawHref.startsWith('http') ? rawHref : 'https://scele.cs.ui.ac.id/mod/forum/' + rawHref;
        const title = cleanText(a.getAttribute('title') || a.textContent);
        const tr = a.closest('tr');
        if (!tr) continue;
        const timeEl = tr.querySelector('time');
        let dateMs = null;
        let dateText = '';
        if (timeEl) {
            const dt = timeEl.getAttribute('datetime');
            if (dt) {
                const d = new Date(dt);
                if (!isNaN(d.getTime())) {
                    dateMs = d.getTime();
                }
            }
            if (!dateMs) {
                const ts = timeEl.getAttribute('data-timestamp');
                if (ts && /^\d+$/.test(ts)) {
                    dateMs = parseInt(ts, 10) * 1000;
                }
            }
            dateText = cleanText(timeEl.textContent);
            if (!dateMs && dateText) {
                dateMs = parseShortDate(dateText);
            }
        }
        let author = '';
        const authorCell = tr.querySelector('td.author');
        if (authorCell) {
            const nameDiv = authorCell.querySelector('.text-truncate, .mb-1');
            if (nameDiv) author = cleanText(nameDiv.textContent);
            if (!author) {
                const userLink = authorCell.querySelector('a[href*="/user/view.php"]');
                if (userLink) author = cleanText(userLink.textContent);
            }
        }
        result.push({ title, url, dateMs, dateText, author });
    }
    return result;
}
