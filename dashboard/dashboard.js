(function () {
    'use strict';

    let _allCourses = [];

    document.title = 'SCELE Summary';
    startFlow().catch((err) => {
        document.getElementById('content').innerHTML =
            '<div class="error">Error: ' + escapeHtml(err.message) + '</div>';
        setStatus('Failed', false);
    });

    function setStatus(text, loading) {
        const sb = document.getElementById('status');
        const st = document.getElementById('status-text');
        if (st) st.textContent = text;
        if (sb) {
            const sp = sb.querySelector('.spinner');
            if (loading && !sp) {
                const s = document.createElement('div');
                s.className = 'spinner';
                sb.insertBefore(s, sb.firstChild);
            } else if (!loading && sp) {
                sp.remove();
            }
            sb.style.display = text ? 'flex' : 'none';
        }
    }

    async function startFlow() {
        if (_allCourses.length === 0) {
            setStatus('Fetching course list…', true);
            const homeHtml = await fetchText('/');
            _allCourses = parseCourses(homeHtml);
            if (_allCourses.length === 0) {
                throw new Error('No courses found. Are you logged into SCELE?');
            }
        }
        setStatus('', false);
        showCoursePicker(_allCourses);
    }

    function showCoursePicker(allCourses) {
        const saved = loadSelected();
        const groups = groupCoursesByCategory(allCourses);

        const groupHtml = Object.entries(groups)
            .map(([groupName, courses]) => {
                const items = courses
                    .map((c) => {
                        const checked = saved.includes(c.id) ? 'checked' : '';
                        return `
                        <label class="course-item">
                            <input type="checkbox" value="${c.id}" ${checked} class="course-checkbox">
                            <span class="course-item-name">${escapeHtml(c.title)}</span>
                            <span class="course-item-id">#${c.id}</span>
                        </label>`;
                    })
                    .join('');
                return `
                    <div class="course-group">
                        <div class="course-group-title">${escapeHtml(groupName)}</div>
                        ${items}
                    </div>`;
            })
            .join('');

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="picker-card">
                <h2>Pick courses</h2>
                <p>Found ${allCourses.length} courses. Select which ones to summarize, then choose a feature below. Your selection will be remembered.</p>
                <div class="picker-toolbar">
                    <button class="btn-link" id="select-all">Select all</button>
                    <button class="btn-link" id="select-none">Clear</button>
                    <button class="btn-link" id="select-current">Select current semester</button>
                </div>
                ${groupHtml}
                <div class="feature-buttons feature-buttons-3">
                    <button class="feature-btn" id="feat-assign">📋 Assignments &amp; Quizzes</button>
                    <button class="feature-btn secondary" id="feat-announce">📢 Announcements</button>
                    <button class="feature-btn tertiary" id="feat-forums">📚 Forums</button>
                </div>
            </div>
        `;

        const checkboxes = () => content.querySelectorAll('.course-checkbox');
        document.getElementById('select-all').onclick = () =>
            checkboxes().forEach((cb) => (cb.checked = true));
        document.getElementById('select-none').onclick = () =>
            checkboxes().forEach((cb) => (cb.checked = false));
        document.getElementById('select-current').onclick = () => {
            const currentYear = new Date().getFullYear();
            checkboxes().forEach((cb) => {
                const course = allCourses.find((c) => c.id === cb.value);
                cb.checked = !!course && courseLooksCurrent(course.title, currentYear);
            });
        };

        const getSelected = () => {
            const ids = Array.from(checkboxes()).filter((cb) => cb.checked).map((cb) => cb.value);
            if (ids.length === 0) {
                alert('Pick at least one course.');
                return null;
            }
            saveSelected(ids);
            return allCourses.filter((c) => ids.includes(c.id));
        };

        document.getElementById('feat-assign').onclick = async () => {
            const chosen = getSelected();
            if (!chosen) return;
            await runAssignmentsScraper(chosen);
        };
        document.getElementById('feat-announce').onclick = async () => {
            const chosen = getSelected();
            if (!chosen) return;
            await runAnnouncementsScraper(chosen);
        };
        document.getElementById('feat-forums').onclick = async () => {
            const chosen = getSelected();
            if (!chosen) return;
            await runForumsScraper(chosen);
        };
    }

    function groupCoursesByCategory(courses) {
        const groups = {};
        for (const c of courses) {
            const m = c.title.match(/^\[([^\]]+)\]/);
            const key = m ? m[1] : 'Other';
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        }
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });
        const sorted = {};
        for (const k of sortedKeys) sorted[k] = groups[k];
        return sorted;
    }

    function courseLooksCurrent(title, year) {
        const re = new RegExp(`(${year - 1}/${year}|${year}/${year + 1}|\\b${year}\\b)`);
        return re.test(title);
    }

    function backButtonHtml() {
        return `<button class="btn-back" id="back-btn">← Back to courses</button>`;
    }
    function wireBackButton() {
        const b = document.getElementById('back-btn');
        if (b) b.onclick = () => showCoursePicker(_allCourses);
    }

    async function runAssignmentsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching ${courses.length} course pages…`, true);

        const allItems = [];
        const coursePages = await Promise.all(
            courses.map((c) =>
                fetchText('/course/view.php?id=' + c.id).then(
                    (html) => ({ course: c, html }),
                    () => ({ course: c, html: null })
                )
            )
        );

        for (const { course, html } of coursePages) {
            if (!html) continue;
            const items = parseActivities(html, course);
            allItems.push(...items);
        }

        allItems.sort((a, b) => {
            const da = a.deadlineMs || 0;
            const db = b.deadlineMs || 0;
            return db - da;
        });

        setStatus(`Loaded ${allItems.length} items. Checking submission status…`, true);

        const now = Date.now();
        for (const item of allItems) {
            if (item.deadlineMs && item.deadlineMs < now) {
                item.status = 'past';
            }
        }

        renderTable(allItems);

        const upcomingItems = allItems.filter((item) => item.status !== 'past');
        if (upcomingItems.length > 0) {
            setStatus(`Checking status for ${upcomingItems.length} upcoming items…`, true);
            await enrichStatus(upcomingItems, updateRow);
        }
        setStatus(`Done. ${allItems.length} items.`, false);

        window.__sceleAllItems = allItems;
    }

    async function fetchAllStatuses() {
        const items = window.__sceleAllItems;
        if (!items) return;
        const btn = document.getElementById('fetch-all-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Fetching all…';
        }
        setStatus(`Checking all ${items.length} items…`, true);

        for (const item of items) {
            if (item.status === 'past') {
                item.status = 'loading';
                updateRow(item);
            }
        }

        await enrichStatus(items, updateRow);
        setStatus(`Done. All ${items.length} statuses checked.`, false);
        if (btn) {
            btn.textContent = '✓ All fetched';
        }
    }

    function renderTable(items) {
        const content = document.getElementById('content');
        if (items.length === 0) {
            content.innerHTML = '<div class="empty">No assignments or quizzes found.</div>';
            return;
        }

        const now = Date.now();
        const rows = items
            .map((item, i) => {
                const dlClass = deadlineClass(item.deadlineMs, now);
                const dlText = item.deadline
                    ? `${item.deadlineLabel}: ${item.deadline}`
                    : '<span style="color:#9ca3af">—</span>';
                return `
                <tr data-row-id="${i}">
                    <td>
                        <a class="row-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.name)}</a>
                    </td>
                    <td><span class="course-name">${escapeHtml(shortenCourse(item.course))}</span></td>
                    <td><span class="pill pill-${item.type === 'Assignment' ? 'assign' : 'quiz'}">${item.type}</span></td>
                    <td><span class="${dlClass}">${dlText}</span></td>
                    <td class="status-cell">${statusPill(item.status, item.deadlineMs, now)}</td>
                </tr>
            `;
            })
            .join('');

        content.innerHTML = `
            <div class="toolbar" style="justify-content: space-between">
                ${backButtonHtml()}
                <button class="btn-fetch-all" id="fetch-all-btn" title="Check done/not done for past items too">🔄 Fetch all statuses</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Assignment / Quiz</th>
                        <th>Course</th>
                        <th>Type</th>
                        <th>Deadline</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        window.__sceleItems = items;

        const fetchBtn = document.getElementById('fetch-all-btn');
        if (fetchBtn) {
            fetchBtn.onclick = () => fetchAllStatuses();
        }
        wireBackButton();
    }

    function updateRow(item) {
        const items = window.__sceleItems || [];
        const i = items.indexOf(item);
        if (i < 0) return;
        const tr = document.querySelector(`tr[data-row-id="${i}"]`);
        if (!tr) return;
        const cell = tr.querySelector('.status-cell');
        if (cell) cell.innerHTML = statusPill(item.status, item.deadlineMs, Date.now());
    }

    function statusPill(status, deadlineMs, now) {
        const isPast = deadlineMs && deadlineMs < now;
        if (status === 'loading')
            return '<span class="pill pill-loading">…</span>';
        if (status === 'past')
            return '<span class="pill pill-past">Past</span>';
        if (status === 'done')
            return '<span class="pill pill-done">✓ Done</span>';
        if (status === 'notdone' && isPast)
            return '<span class="pill pill-pastdue">Past due</span>';
        if (status === 'notdone')
            return '<span class="pill pill-notdone">Not done</span>';
        return '<span class="pill pill-loading">?</span>';
    }

    function shortenCourse(name) {
        return name
            .replace(/^\[[^\]]+\]\s*/, '')
            .replace(/\s*\([A-Z,\s]+\)\s*/, ' ')
            .replace(/Genap \d{4}\/\d{4}/, '')
            .replace(/Ganjil \d{4}\/\d{4}/, '')
            .trim();
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

    async function runAnnouncementsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching forum index for ${courses.length} courses…`, true);

        const forumIndexes = await Promise.all(
            courses.map((c) =>
                fetchText('/mod/forum/index.php?id=' + c.id).then(
                    (html) => ({ course: c, html }),
                    () => ({ course: c, html: null })
                )
            )
        );

        const generalForums = [];
        for (const { course, html } of forumIndexes) {
            if (!html) continue;
            const forums = parseGeneralForums(html);
            for (const f of forums) {
                generalForums.push({ course, ...f });
            }
        }

        if (generalForums.length === 0) {
            content.innerHTML = `
                <div class="toolbar" style="justify-content: space-between">
                    ${backButtonHtml()}
                    <div></div>
                </div>
                <div class="empty">No general forums found in selected courses.</div>
            `;
            wireBackButton();
            setStatus('Done.', false);
            return;
        }

        setStatus(`Fetching ${generalForums.length} forum pages…`, true);

        const forumPages = await Promise.all(
            generalForums.map((f) =>
                fetchText('/mod/forum/view.php?f=' + f.forumId).then(
                    (html) => ({ ...f, html }),
                    () => ({ ...f, html: null })
                )
            )
        );

        const allPosts = [];
        for (const f of forumPages) {
            if (!f.html) continue;
            const posts = parseForumDiscussions(f.html);
            for (const p of posts) {
                allPosts.push({
                    ...p,
                    course: f.course.title,
                    courseId: f.course.id,
                    forumName: f.forumName,
                });
            }
        }

        allPosts.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));

        renderAnnouncementsTable(allPosts);
        setStatus(`Done. ${allPosts.length} announcements.`, false);
    }

    function renderAnnouncementsTable(posts) {
        const content = document.getElementById('content');
        if (posts.length === 0) {
            content.innerHTML = `
                <div class="toolbar" style="justify-content: space-between">
                    ${backButtonHtml()}
                    <div></div>
                </div>
                <div class="empty">No announcements found.</div>
            `;
            wireBackButton();
            return;
        }

        const rows = posts.map((p) => {
            const dateLabel = p.dateMs ? formatDate(p.dateMs) : escapeHtml(p.dateText || '—');
            return `
                <tr>
                    <td><a class="row-link" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a></td>
                    <td><span class="course-name">${escapeHtml(shortenCourse(p.course))}</span></td>
                    <td>${escapeHtml(p.author || '—')}</td>
                    <td>${dateLabel}</td>
                </tr>`;
        }).join('');

        content.innerHTML = `
            <div class="toolbar" style="justify-content: space-between">
                ${backButtonHtml()}
                <div style="font-size:13px;color:#6b7280">${posts.length} announcements</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Course</th>
                        <th>Author</th>
                        <th>Date Started</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        wireBackButton();
    }

    async function runForumsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching forum index for ${courses.length} courses…`, true);

        const forumIndexes = await Promise.all(
            courses.map((c) =>
                fetchText('/mod/forum/index.php?id=' + c.id).then(
                    (html) => ({ course: c, html }),
                    () => ({ course: c, html: null })
                )
            )
        );

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
})();
