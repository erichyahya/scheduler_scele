async function runAnnouncementsScraper(courses) {
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
    if (signal.aborted) return;

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
