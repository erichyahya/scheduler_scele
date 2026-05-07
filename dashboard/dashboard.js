let _allCourses = [];

document.title = 'SCELE Summary';
initThemeToggle();
startFlow().catch((err) => {
    document.getElementById('content').innerHTML =
        '<div class="error">Error: ' + escapeHtml(err.message) + '</div>';
    setStatus('Failed', false);
});

function initThemeToggle() {
    const THEME_KEY = 'scele-summary-theme';
    const btn = document.getElementById('theme-toggle');
    const cached = (() => {
        try { return localStorage.getItem(THEME_KEY); } catch { return null; }
    })();
    document.documentElement.classList.remove('preload-dark');
    setDark(cached === 'dark');

    // Reconcile with chrome.storage.local (shared with SCELE content scripts).
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(THEME_KEY, (data) => {
            const stored = data && data[THEME_KEY];
            if (stored === 'dark' || stored === 'light') {
                if (stored !== cached) {
                    try { localStorage.setItem(THEME_KEY, stored); } catch {}
                    setDark(stored === 'dark');
                }
            } else if (cached === 'dark' || cached === 'light') {
                chrome.storage.local.set({ [THEME_KEY]: cached });
            }
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[THEME_KEY]) return;
            const next = changes[THEME_KEY].newValue;
            if (next !== 'dark' && next !== 'light') return;
            try { localStorage.setItem(THEME_KEY, next); } catch {}
            setDark(next === 'dark');
        });
    }

    if (btn) {
        btn.onclick = () => {
            const nowDark = !document.documentElement.classList.contains('dark');
            setDark(nowDark);
            const value = nowDark ? 'dark' : 'light';
            try { localStorage.setItem(THEME_KEY, value); } catch {}
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [THEME_KEY]: value });
            }
        };
    }

    function setDark(isDark) {
        document.documentElement.classList.toggle('dark', isDark);
        if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    }
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

function showCoursePicker(allCourses) {
    const saved = loadSelected();
    const groups = groupCoursesByCategory(allCourses);
    const COLLAPSE_LIMIT = 6;
    const needsCollapse = allCourses.length > COLLAPSE_LIMIT;

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
                    <div class="course-grid">${items}</div>
                </div>`;
        })
        .join('');

    const seeMoreBtn = needsCollapse
        ? `<button class="btn-see-more" id="see-more">See more</button>`
        : '';

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="picker-layout">
            <div class="picker-main">
                <div class="picker-card">
                    <h2>Pick courses</h2>
                    <p>Found ${allCourses.length} courses. Select which ones to summarize, then choose a feature below. Your selection will be remembered.</p>
                    <div class="picker-toolbar">
                        <button class="btn-link" id="select-all">Select all</button>
                        <button class="btn-link" id="select-none">Clear</button>
                        <button class="btn-link" id="select-current">Select current semester</button>
                    </div>
                    <div class="course-list ${needsCollapse ? 'collapsed' : ''}">${groupHtml}</div>
                    ${seeMoreBtn ? `<div class="see-more-row">${seeMoreBtn}</div>` : ''}
                </div>
                <div class="feature-buttons feature-buttons-3">
                    <button class="feature-btn" id="feat-assign">📋 Assignments &amp; Quizzes</button>
                    <button class="feature-btn secondary" id="feat-announce">📢 Announcements</button>
                    <button class="feature-btn tertiary" id="feat-forums">📚 Forums</button>
                </div>
            </div>
            <aside class="donate-card">
                <h3>Support development</h3>
                <p>Dibuat dengan ❤️ oleh sesama mahasiswa buat kalian. Kalau tools ini bikin kuliahmu sedikit lebih ringan, secangkir kopi dari kamu bisa jadi bahan bakar kami untuk terus berkarya ☕✨</p>
                <div class="donate-qr">
                    <img src="../assets/qr-scele-scheduler.png" alt="SCELE Scheduler donation QR code">
                </div>
                <a class="donate-link" href="https://forms.gle/UJaNtpmsQi3QZHwm9" target="_blank" rel="noopener">Send feedback</a>
            </aside>
        </div>
    `;

    const seeMoreEl = document.getElementById('see-more');
    if (seeMoreEl) {
        seeMoreEl.onclick = () => {
            const list = content.querySelector('.course-list');
            const expanded = list.classList.toggle('collapsed') === false;
            seeMoreEl.textContent = expanded ? 'See less' : 'See more';
        };
    }

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
    if (b) b.onclick = () => {
        startFetchSession();
        setStatus('', false);
        showCoursePicker(_allCourses);
    };
}
