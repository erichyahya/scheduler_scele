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
                } else if (/^Closed?s?:/.test(txt)) {
                    closedText = txt.replace(/^Closed?s?:\s*/, '').trim();
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

    renderAssignmentsTable(allItems);

    const upcomingItems = allItems.filter((item) => item.status !== 'past');
    if (upcomingItems.length > 0) {
        setStatus(`Checking status for ${upcomingItems.length} upcoming items…`, true);
        await enrichStatus(upcomingItems, updateAssignmentRow);
    }
    setStatus(`Done. ${allItems.length} items.`, false);

    window.__sceleAllItems = allItems;
}

function renderAssignmentsTable(items) {
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

function updateAssignmentRow(item) {
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
            updateAssignmentRow(item);
        }
    }

    await enrichStatus(items, updateAssignmentRow);
    setStatus(`Done. All ${items.length} statuses checked.`, false);
    if (btn) {
        btn.textContent = '✓ All fetched';
    }
}
