// ==UserScript==
// @name         Erich
// @namespace    scele-summary
// @version      0.4
// @description  Notion-style dashboard for SCELE: assignments, quizzes, announcements, and forums
// @author       you
// @match        https://scele.cs.ui.ac.id/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const DASHBOARD_FLAG = '#scele-summary';
    const isDashboard = location.hash === DASHBOARD_FLAG;
    const STORAGE_KEY = 'scele-summary-selected-courses';
    let _allCourses = [];

    if (isDashboard) {
        renderDashboard();
    } else {
        injectButton();
    }

    /* ---------- BUTTON ON SCELE PAGES ---------- */
    function injectButton() {
        const btn = document.createElement('button');
        btn.textContent = '📋 Summary';
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
            transition: transform 0.15s, box-shadow 0.15s;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.5)';
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'none';
            btn.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4)';
        };
        btn.onclick = () => {
            window.open('https://scele.cs.ui.ac.id/' + DASHBOARD_FLAG, '_blank');
        };
        document.body.appendChild(btn);
    }

    /* ---------- DASHBOARD PAGE ---------- */
    function renderDashboard() {
        document.title = 'SCELE Summary';
        // wipe the page
        document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());
        document.body.innerHTML = '';
        document.documentElement.style.background = '#fafafa';

        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; }
            body {
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
                color: #1f2937;
                background: #fafafa;
            }
            .container { max-width: 1200px; margin: 0 auto; padding: 40px 32px; }
            h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
            .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
            .status-bar {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 16px;
                font-size: 13px;
                color: #4b5563;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .spinner {
                width: 14px; height: 14px;
                border: 2px solid #e5e7eb;
                border-top-color: #2563eb;
                border-radius: 50%;
                animation: spin 0.7s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
                font-size: 13px;
            }
            thead { background: #f9fafb; }
            th {
                text-align: left;
                padding: 10px 14px;
                font-weight: 600;
                color: #6b7280;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                border-bottom: 1px solid #e5e7eb;
            }
            td {
                padding: 12px 14px;
                border-bottom: 1px solid #f1f3f5;
                vertical-align: top;
            }
            tr:last-child td { border-bottom: none; }
            tr:hover td { background: #fafbfc; }
            .pill {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
            }
            .pill-assign { background: #fef3c7; color: #92400e; }
            .pill-quiz { background: #ddd6fe; color: #5b21b6; }
            .pill-done { background: #d1fae5; color: #065f46; }
            .pill-notdone { background: #fee2e2; color: #991b1b; }
            .pill-pastdue { background: #f3f4f6; color: #6b7280; }
            .pill-loading { background: #f3f4f6; color: #9ca3af; }
            .deadline-soon { color: #dc2626; font-weight: 600; }
            .deadline-week { color: #d97706; }
            .deadline-far { color: #4b5563; }
            .deadline-past { color: #9ca3af; text-decoration: line-through; }
            a.row-link {
                color: #2563eb;
                text-decoration: none;
                font-weight: 500;
            }
            a.row-link:hover { text-decoration: underline; }
            .course-name {
                color: #6b7280;
                font-size: 12px;
            }
            .empty {
                text-align: center;
                padding: 40px;
                color: #9ca3af;
            }
            .error {
                background: #fef2f2;
                border: 1px solid #fecaca;
                color: #991b1b;
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
            }
            .toolbar {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 12px;
                gap: 8px;
            }
            .btn-fetch-all {
                background: white;
                border: 1px solid #d1d5db;
                color: #4b5563;
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.15s;
            }
            .btn-fetch-all:hover { background: #f9fafb; }
            .btn-fetch-all:disabled { color: #9ca3af; cursor: not-allowed; }
            .pill-past { background: #f3f4f6; color: #6b7280; }

            /* Course picker */
            .picker-card {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 16px;
            }
            .picker-card h2 {
                font-size: 18px; font-weight: 600; margin: 0 0 6px;
            }
            .picker-card p { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
            .picker-toolbar {
                display: flex; gap: 8px; margin-bottom: 12px;
                padding-bottom: 12px; border-bottom: 1px solid #f1f3f5;
                flex-wrap: wrap;
            }
            .btn-link {
                background: none; border: none; color: #2563eb;
                font-size: 13px; cursor: pointer; padding: 4px 8px;
                border-radius: 4px; font-weight: 500;
            }
            .btn-link:hover { background: #eff6ff; }
            .course-group { margin-bottom: 14px; }
            .course-group-title {
                font-size: 11px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 8px;
                padding: 0 4px;
            }
            .course-item {
                display: flex; align-items: center; gap: 10px;
                padding: 8px 10px; border-radius: 6px; cursor: pointer;
                transition: background 0.1s;
            }
            .course-item:hover { background: #f9fafb; }
            .course-item input[type="checkbox"] {
                width: 16px; height: 16px; cursor: pointer; accent-color: #2563eb;
            }
            .course-item-name { font-size: 13px; flex: 1; }
            .course-item-id { font-size: 11px; color: #9ca3af; }

            /* Feature buttons */
            .feature-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                padding-top: 16px;
                border-top: 1px solid #f1f3f5;
                margin-top: 8px;
            }
            .feature-buttons-3 { grid-template-columns: 1fr 1fr 1fr; }
            .feature-btn {
                background: #2563eb; color: white; border: none;
                padding: 16px 20px; border-radius: 8px;
                font-size: 14px; font-weight: 600;
                cursor: pointer; transition: background 0.15s;
                display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .feature-btn:hover { background: #1d4ed8; }
            .feature-btn.secondary { background: #7c3aed; }
            .feature-btn.secondary:hover { background: #6d28d9; }
            .feature-btn.tertiary { background: #059669; }
            .feature-btn.tertiary:hover { background: #047857; }

            /* Forum cards (Forums feature) */
            .forum-card {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                margin-bottom: 14px;
                overflow: hidden;
            }
            .forum-card-header {
                padding: 14px 18px;
                background: #fafbfc;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .forum-card-title {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                margin: 0;
            }
            .forum-card-meta {
                font-size: 11px;
                color: #6b7280;
                margin-top: 2px;
            }
            .forum-card-course {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #2563eb;
                background: #eff6ff;
                padding: 3px 8px;
                border-radius: 4px;
                white-space: nowrap;
            }
            .forum-card-empty {
                padding: 18px;
                color: #9ca3af;
                font-size: 13px;
                font-style: italic;
            }
            .discussion-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 18px;
                border-bottom: 1px solid #f1f3f5;
                font-size: 13px;
            }
            .discussion-row:last-child { border-bottom: none; }
            .discussion-row:hover { background: #fafbfc; }
            .discussion-title {
                flex: 1;
                min-width: 0;
            }
            .discussion-title a {
                color: #2563eb;
                text-decoration: none;
                font-weight: 500;
            }
            .discussion-title a:hover { text-decoration: underline; }
            .discussion-meta {
                color: #6b7280;
                font-size: 11px;
                margin-top: 2px;
            }
            .pill-replied { background: #d1fae5; color: #065f46; }
            .pill-notreplied { background: #fef3c7; color: #92400e; }
            .pill-unchecked { background: #f3f4f6; color: #9ca3af; }

            /* Back button */
            .btn-back {
                background: white; border: 1px solid #d1d5db;
                color: #4b5563; padding: 6px 12px;
                border-radius: 6px; font-size: 13px;
                cursor: pointer; font-weight: 500;
            }
            .btn-back:hover { background: #f9fafb; }
        `;
        document.head.appendChild(style);

        document.body.innerHTML = `
            <div class="container">
                <h1>📋 SCELE Summary</h1>
                <div class="subtitle">All your assignments and quizzes, sorted by deadline</div>
                <div class="status-bar" id="status">
                    <div class="spinner"></div>
                    <span id="status-text">Fetching your courses…</span>
                </div>
                <div id="content"></div>
            </div>
        `;

        startFlow().catch((err) => {
            document.getElementById('content').innerHTML =
                '<div class="error">Error: ' + escapeHtml(err.message) + '</div>';
            setStatus('Failed', false);
        });
    }

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

    /* ---------- MAIN FLOW (course picker) ---------- */
    async function startFlow() {
        // Fetch courses once
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

    function loadSelected() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
    function saveSelected(ids) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        } catch {}
    }

    function backButtonHtml() {
        return `<button class="btn-back" id="back-btn">← Back to courses</button>`;
    }
    function wireBackButton() {
        const b = document.getElementById('back-btn');
        if (b) b.onclick = () => showCoursePicker(_allCourses);
    }

    /* ---------- ASSIGNMENTS SCRAPER ---------- */
    async function runAssignmentsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching ${courses.length} course pages…`, true);

        // Fetch each course page in parallel, parse activities
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

        // Sort by deadline (newest first)
        allItems.sort((a, b) => {
            const da = a.deadlineMs || 0;
            const db = b.deadlineMs || 0;
            return db - da;
        });

        setStatus(
            `Loaded ${allItems.length} items. Checking submission status…`,
            true
        );

        // Mark past-deadline items as 'past' immediately (no fetch needed)
        const now = Date.now();
        for (const item of allItems) {
            if (item.deadlineMs && item.deadlineMs < now) {
                item.status = 'past';
            }
        }

        renderTable(allItems);

        // Only fetch status for upcoming items (deadline not passed)
        const upcomingItems = allItems.filter((item) => item.status !== 'past');
        if (upcomingItems.length > 0) {
            setStatus(
                `Checking status for ${upcomingItems.length} upcoming items…`,
                true
            );
            await enrichStatus(upcomingItems);
        }
        setStatus(`Done. ${allItems.length} items.`, false);

        // Store all items globally for fetch-all button
        window.__sceleAllItems = allItems;
    }

    /* ---------- FETCH ALL HANDLER ---------- */
    async function fetchAllStatuses() {
        const items = window.__sceleAllItems;
        if (!items) return;
        const btn = document.getElementById('fetch-all-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Fetching all…';
        }
        setStatus(`Checking all ${items.length} items…`, true);

        // Reset past items to loading so they get fetched
        for (const item of items) {
            if (item.status === 'past') {
                item.status = 'loading';
                updateRow(item);
            }
        }

        await enrichStatus(items);
        setStatus(`Done. All ${items.length} statuses checked.`, false);
        if (btn) {
            btn.textContent = '✓ All fetched';
        }
    }

    /* ---------- HTTP ---------- */
    async function fetchText(path) {
        const url = path.startsWith('http')
            ? path
            : 'https://scele.cs.ui.ac.id' + path;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
        return await res.text();
    }

    /* ---------- PARSERS ---------- */
    function parseHtml(html) {
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function parseCourses(html) {
        const doc = parseHtml(html);
        // Look for the "My courses" navigation block
        // Course links look like: /course/view.php?id=NNNN with title attr
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
            // only count items inside My courses tree (type_course class)
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
        const lis = doc.querySelectorAll(
            'li.activity.assign, li.activity.quiz'
        );
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
                // remove the "accesshide" span (e.g. " Assignment") inside
                const clone = nameSpan.cloneNode(true);
                clone.querySelectorAll('.accesshide').forEach((e) => e.remove());
                name = cleanText(clone.textContent);
            }

            // Parse dates
            let dueText = '';
            let closedText = '';
            const dateRegion = li.querySelector(
                '[data-region="activity-dates"]'
            );
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
                status: 'loading', // will be filled later
            });
        }
        return items;
    }

    function parseMoodleDate(s) {
        // e.g. "Saturday, 14 February 2026, 11:55 PM"
        const cleaned = s.replace(/^[A-Za-z]+,\s*/, '').trim();
        // "14 February 2026, 11:55 PM"
        const m = cleaned.match(
            /(\d+)\s+(\w+)\s+(\d{4}),\s+(\d+):(\d+)\s*(AM|PM)/i
        );
        if (!m) return null;
        const [, day, monthStr, year, hourStr, minStr, ap] = m;
        const months = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        };
        const mo = months[monthStr.toLowerCase()];
        if (mo === undefined) return null;
        let hour = parseInt(hourStr, 10);
        if (ap.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
        const d = new Date(+year, mo, +day, hour, +minStr);
        return d.getTime();
    }

    /* ---------- STATUS ENRICHMENT ---------- */
    async function enrichStatus(items) {
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
                updateRow(item);
            }
        }
        const workers = [];
        for (let k = 0; k < concurrency; k++) workers.push(worker());
        await Promise.all(workers);
    }

    function detectStatus(html, type) {
        const text = html.toLowerCase();
        if (type === 'Assignment') {
            // Common Moodle assignment status strings
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
            // Group submission heuristic: "Submitted for grading" inside group section
            if (text.includes('graded')) return 'done';
            return 'notdone';
        } else {
            // Quiz
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
                // attempts allowed alone doesn't mean done; need "Finished" marker
                if (text.includes('state</th>') && text.includes('finished'))
                    return 'done';
                return 'notdone';
            }
            return 'notdone';
        }
    }

    /* ---------- TABLE RENDER ---------- */
    function renderTable(items) {
        const content = document.getElementById('content');
        if (items.length === 0) {
            content.innerHTML =
                '<div class="empty">No assignments or quizzes found.</div>';
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

        // store items globally so updateRow can find them
        window.__sceleItems = items;

        // wire up fetch-all button
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

    function deadlineClass(ms, now) {
        if (!ms) return 'deadline-far';
        const days = (ms - now) / 86400000;
        if (days < 0) return 'deadline-past';
        if (days < 2) return 'deadline-soon';
        if (days < 7) return 'deadline-week';
        return 'deadline-far';
    }

    /* ---------- HELPERS ---------- */
    function cleanText(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }
    function shortenCourse(name) {
        // Remove "[Reg]" prefix and "Genap 2025/2026" suffix for cleaner display
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
    /* ---------- ANNOUNCEMENTS SCRAPER ---------- */
    async function runAnnouncementsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching forum index for ${courses.length} courses…`, true);

        // Step 1: for each course, fetch /mod/forum/index.php?id=COURSE_ID
        const forumIndexes = await Promise.all(
            courses.map((c) =>
                fetchText('/mod/forum/index.php?id=' + c.id).then(
                    (html) => ({ course: c, html }),
                    () => ({ course: c, html: null })
                )
            )
        );

        // Step 2: parse each forum index to find all "General forums"
        const generalForums = []; // { course, forumId, forumName }
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

        // Step 3: fetch each general forum's discussion list
        const forumPages = await Promise.all(
            generalForums.map((f) =>
                fetchText('/mod/forum/view.php?f=' + f.forumId).then(
                    (html) => ({ ...f, html }),
                    () => ({ ...f, html: null })
                )
            )
        );

        // Step 4: parse all discussion posts
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

        // Step 5: sort by date newest first
        allPosts.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));

        renderAnnouncementsTable(allPosts);
        setStatus(`Done. ${allPosts.length} announcements.`, false);
    }

    function parseGeneralForums(html) {
        return parseForumsByCategory(html, 'general');
    }

    function parseLearningForums(html) {
        return parseForumsByCategory(html, 'learning');
    }

    function parseForumsByCategory(html, category) {
        const doc = parseHtml(html);
        // The forums index has <h2>General forums</h2> followed by a table,
        // then <h2>Learning forums</h2> followed by another table.
        const result = [];
        const headings = doc.querySelectorAll('h2');
        for (const h of headings) {
            const text = h.textContent.trim().toLowerCase();
            const matches = category === 'general'
                ? (text === 'general forums' || text.includes('general forum'))
                : (text === 'learning forums' || text.includes('learning forum'));
            if (matches) {
                // Find next table sibling
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
                    if (!name) continue; // skip the reply-count links
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
        // Each discussion is a row with a topic link and a time element
        const topicLinks = doc.querySelectorAll('a.w-100.h-100.d-block[href*="discuss.php?d="]');
        for (const a of topicLinks) {
            const rawHref = a.getAttribute('href') || '';
            const url = rawHref.startsWith('http') ? rawHref : 'https://scele.cs.ui.ac.id/mod/forum/' + rawHref;
            const title = cleanText(a.getAttribute('title') || a.textContent);
            // Find the closest <tr> that contains this link
            const tr = a.closest('tr');
            if (!tr) continue;
            // Find the FIRST time element in the row (date started)
            const timeEl = tr.querySelector('time');
            let dateMs = null;
            let dateText = '';
            if (timeEl) {
                // Try datetime attribute first
                const dt = timeEl.getAttribute('datetime');
                if (dt) {
                    const d = new Date(dt);
                    if (!isNaN(d.getTime())) {
                        dateMs = d.getTime();
                    }
                }
                // Fallback: data-timestamp (unix seconds)
                if (!dateMs) {
                    const ts = timeEl.getAttribute('data-timestamp');
                    if (ts && /^\d+$/.test(ts)) {
                        dateMs = parseInt(ts, 10) * 1000;
                    }
                }
                dateText = cleanText(timeEl.textContent);
                // Last resort: parse from visible text (e.g. "22 Feb 2026")
                if (!dateMs && dateText) {
                    dateMs = parseShortDate(dateText);
                }
            }
            // Author: typically in a div with class containing "text-truncate"
            // Look for the AUTHOR cell which is usually the second td
            let author = '';
            const authorCell = tr.querySelector('td.author');
            if (authorCell) {
                const nameDiv = authorCell.querySelector('.text-truncate, .mb-1');
                if (nameDiv) author = cleanText(nameDiv.textContent);
                if (!author) {
                    // Fallback: first link in author cell (user link)
                    const userLink = authorCell.querySelector('a[href*="/user/view.php"]');
                    if (userLink) author = cleanText(userLink.textContent);
                }
            }
            result.push({ title, url, dateMs, dateText, author });
        }
        return result;
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

    function parseShortDate(s) {
        // Parses "22 Feb 2026" or "20 Apr 2026" → ms
        const m = s.match(/(\d+)\s+(\w+)\s+(\d{4})/);
        if (!m) return null;
        const months = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        const mo = months[m[2].toLowerCase().slice(0, 3)];
        if (mo === undefined) return null;
        return new Date(+m[3], mo, +m[1]).getTime();
    }

    function formatDate(ms) {
        const d = new Date(ms);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = d.getDate();
        const mo = months[d.getMonth()];
        const yr = d.getFullYear();
        const hr = d.getHours().toString().padStart(2, '0');
        const mn = d.getMinutes().toString().padStart(2, '0');
        return `${day} ${mo} ${yr}, ${hr}:${mn}`;
    }

    /* ---------- FORUMS SCRAPER (Learning forums) ---------- */
    let _currentUserId = null;

    async function getCurrentUserId() {
        if (_currentUserId) return _currentUserId;
        // Try to detect via SCELE's M.cfg if available (only on real SCELE pages, not our blank dashboard)
        try {
            // Fetch the homepage and look for userid in profile link or page source
            const html = await fetchText('/');
            // Common pattern: /user/profile.php?id=NNNN appears in the user menu
            const m = html.match(/\/user\/profile\.php\?id=(\d+)/);
            if (m) {
                _currentUserId = m[1];
                return _currentUserId;
            }
            // Fallback: M.cfg.userid in inline scripts
            const m2 = html.match(/"userid"\s*:\s*(\d+)/);
            if (m2) {
                _currentUserId = m2[1];
                return _currentUserId;
            }
        } catch {}
        return null;
    }

    async function runForumsScraper(courses) {
        const content = document.getElementById('content');
        content.innerHTML = '';
        setStatus(`Fetching forum index for ${courses.length} courses…`, true);

        // Step 1: for each course, fetch /mod/forum/index.php?id=COURSE_ID
        const forumIndexes = await Promise.all(
            courses.map((c) =>
                fetchText('/mod/forum/index.php?id=' + c.id).then(
                    (html) => ({ course: c, html }),
                    () => ({ course: c, html: null })
                )
            )
        );

        // Step 2: parse each forum index to find all "Learning forums"
        // Preserve order as they appear on the SCELE forums index page
        const learningForums = []; // { course, forumId, forumName, order }
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

        // Step 3: fetch each learning forum's discussion list
        const forumPages = await Promise.all(
            learningForums.map((f) =>
                fetchText('/mod/forum/view.php?f=' + f.forumId).then(
                    (html) => ({ ...f, html }),
                    () => ({ ...f, html: null })
                )
            )
        );

        // Step 4: parse all discussions, attached to their forum
        const forumsWithDiscussions = []; // { course, forumId, forumName, order, discussions[] }
        for (const f of forumPages) {
            const discussions = f.html ? parseForumDiscussions(f.html) : [];
            // Sort discussions newest first
            discussions.sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0));
            forumsWithDiscussions.push({
                course: f.course,
                forumId: f.forumId,
                forumName: f.forumName,
                order: f.order,
                discussions: discussions.map((d) => ({ ...d, replyStatus: null })),
            });
        }

        // Sort forums: by newest discussion date first (forums with no discussions go last)
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

        // Store for the reply check
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

        // Build a flat list of all discussions to check
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

    function detectUserReplied(html, userId) {
        // Look for user profile/view links matching the current user ID inside posts
        // Skip the FIRST occurrence: the original discussion page header may show
        // the original poster's link. We want replies, but checking any occurrence
        // also catches "user replied" cases when the user IS the original poster
        // who later commented. Either way, presence of their link in the page
        // beyond the navbar typically indicates participation.
        // Use a regex matching /user/view.php?id={userId}
        const re = new RegExp(`/user/view\\.php\\?id=${userId}(?:&|"|\\s|>|$)`, 'g');
        const matches = html.match(re);
        if (!matches) return false;
        // The user's link appears in the page header/navbar at least once.
        // Heuristic: if there are 2+ occurrences, they likely posted. If only 1,
        // it's probably just the navbar. Adjust threshold based on testing.
        return matches.length >= 2;
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