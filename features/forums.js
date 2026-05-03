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

function detectUserReplied(html, userId) {
    const re = new RegExp(`/user/view\\.php\\?id=${userId}(?:&|"|\\s|>|$)`, 'g');
    const matches = html.match(re);
    if (!matches) return false;
    return matches.length >= 2;
}

async function runForumsScraper(courses) {
    const signal = startFetchSession();
    const content = document.getElementById('content');
    content.innerHTML = `<div class="toolbar" style="justify-content: space-between">${backButtonHtml()}<div></div></div>`;
    wireBackButton();
    setStatus(`Fetching forum index for ${courses.length} courses…`, true);

    const forumIndexes = await Promise.all(
        courses.map((c) =>
            fetchText('/mod/forum/index.php?id=' + c.id).then(
                (html) => ({ course: c, html }),
                () => ({ course: c, html: null })
            )
        )
    );
    if (signal.aborted) return;

    const learningForums = [];
    for (const { course, html } of forumIndexes) {
        if (!html) continue;
        const forums = parseLearningForums(html);
        forums.forEach((f, idx) => {
            learningForums.push({ course, ...f, order: idx });
        });
    }

    if (learningForums.length === 0) {
        content.innerHTML = `
            <div class="toolbar" style="justify-content: space-between">
                ${backButtonHtml()}
                <div></div>
            </div>
            <div class="empty">No learning forums found in selected courses.</div>
        `;
        wireBackButton();
        setStatus('Done.', false);
        return;
    }

    setStatus(`Fetching ${learningForums.length} forum pages…`, true);

    const forumPages = await Promise.all(
        learningForums.map((f) =>
            fetchText('/mod/forum/view.php?f=' + f.forumId).then(
                (html) => ({ ...f, html }),
                () => ({ ...f, html: null })
            )
        )
    );
    if (signal.aborted) return;

    const forumsWithDiscussions = [];
    for (const f of forumPages) {
        const discussions = f.html ? parseForumDiscussions(f.html) : [];
        discussions.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
        forumsWithDiscussions.push({
            course: f.course,
            forumId: f.forumId,
            forumName: f.forumName,
            order: f.order,
            discussions: discussions.map((d) => ({ ...d, replyStatus: null })),
        });
    }

    forumsWithDiscussions.sort((a, b) => {
        const da = forumNewestDate(a);
        const db = forumNewestDate(b);
        return db - da;
    });

    renderForumsPage(forumsWithDiscussions);
    setStatus(`Done. ${forumsWithDiscussions.length} forums.`, false);
}

function forumNewestDate(forum) {
    if (!forum.discussions || forum.discussions.length === 0) return -1;
    let max = -1;
    for (const d of forum.discussions) {
        const ms = d.dateMs || 0;
        if (ms > max) max = ms;
    }
    return max;
}

function renderForumsPage(forums) {
    const content = document.getElementById('content');
    const totalDiscussions = forums.reduce((acc, f) => acc + f.discussions.length, 0);

    const cards = forums.map((forum, fi) => {
        const courseShort = shortenCourse(forum.course.title);
        if (forum.discussions.length === 0) {
            return `
                <div class="forum-card">
                    <div class="forum-card-header">
                        <div>
                            <h3 class="forum-card-title">${escapeHtml(forum.forumName)}</h3>
                            <div class="forum-card-meta">No posts yet</div>
                        </div>
                        <span class="forum-card-course">${escapeHtml(courseShort)}</span>
                    </div>
                </div>`;
        }
        const rows = forum.discussions.map((d, di) => {
            const dateStr = d.dateMs ? formatDate(d.dateMs) : escapeHtml(d.dateText || '—');
            return `
                <div class="discussion-row" data-forum-idx="${fi}" data-disc-idx="${di}">
                    <div class="discussion-title">
                        <a href="${escapeAttr(d.url)}" target="_blank" rel="noopener">${escapeHtml(d.title)}</a>
                        <div class="discussion-meta">by ${escapeHtml(d.author || 'Unknown')} · ${dateStr}</div>
                    </div>
                    <span class="pill pill-unchecked reply-status">—</span>
                </div>`;
        }).join('');
        return `
            <div class="forum-card">
                <div class="forum-card-header">
                    <div>
                        <h3 class="forum-card-title">${escapeHtml(forum.forumName)}</h3>
                        <div class="forum-card-meta">${forum.discussions.length} discussion${forum.discussions.length === 1 ? '' : 's'}</div>
                    </div>
                    <span class="forum-card-course">${escapeHtml(courseShort)}</span>
                </div>
                ${rows}
            </div>`;
    }).join('');

    content.innerHTML = `
        <div class="toolbar" style="justify-content: space-between">
            ${backButtonHtml()}
            <button class="btn-fetch-all" id="check-replies-btn" title="Check which discussions you've replied to">🔍 Check my replies</button>
        </div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:14px;padding:0 4px">
            ${forums.length} forum${forums.length === 1 ? '' : 's'} · ${totalDiscussions} discussion${totalDiscussions === 1 ? '' : 's'}
        </div>
        ${cards}
    `;
    wireBackButton();

    window.__sceleForums = forums;

    const checkBtn = document.getElementById('check-replies-btn');
    if (checkBtn) {
        checkBtn.onclick = () => checkAllReplies();
    }
}

async function checkAllReplies() {
    const forums = window.__sceleForums;
    if (!forums) return;
    const btn = document.getElementById('check-replies-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Detecting your user ID…';
    }

    const userId = await getCurrentUserId();
    if (!userId) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔍 Check my replies';
        }
        alert('Could not detect your user ID. Make sure you are logged into SCELE.');
        return;
    }

    const tasks = [];
    forums.forEach((forum, fi) => {
        forum.discussions.forEach((d, di) => {
            tasks.push({ forum, discussion: d, fi, di });
        });
    });

    let done = 0;
    const total = tasks.length;
    if (btn) btn.textContent = `Checking 0 / ${total}…`;
    setStatus(`Checking ${total} discussions for your replies…`, true);

    const concurrency = 4;
    let idx = 0;
    async function worker() {
        while (idx < tasks.length) {
            const i = idx++;
            const task = tasks[i];
            try {
                const html = await fetchText(task.discussion.url);
                task.discussion.replyStatus = detectUserReplied(html, userId)
                    ? 'replied'
                    : 'notreplied';
            } catch {
                task.discussion.replyStatus = 'unknown';
            }
            done++;
            updateReplyPill(task.fi, task.di, task.discussion.replyStatus);
            if (btn) btn.textContent = `Checking ${done} / ${total}…`;
        }
    }
    const workers = [];
    for (let k = 0; k < concurrency; k++) workers.push(worker());
    await Promise.all(workers);

    if (btn) {
        btn.textContent = '✓ Replies checked';
    }
    setStatus(`Done. Checked ${total} discussions.`, false);
}

function updateReplyPill(forumIdx, discIdx, status) {
    const row = document.querySelector(
        `.discussion-row[data-forum-idx="${forumIdx}"][data-disc-idx="${discIdx}"]`
    );
    if (!row) return;
    const pill = row.querySelector('.reply-status');
    if (!pill) return;
    if (status === 'replied') {
        pill.className = 'pill pill-replied reply-status';
        pill.textContent = '✓ Replied';
    } else if (status === 'notreplied') {
        pill.className = 'pill pill-notreplied reply-status';
        pill.textContent = '✗ Not replied';
    } else {
        pill.className = 'pill pill-unchecked reply-status';
        pill.textContent = '?';
    }
}
