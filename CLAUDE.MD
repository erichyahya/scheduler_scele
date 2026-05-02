# SCELE Summary Dashboard

## Project Overview

SCELE Summary is a browser tool that improves the SCELE e-learning platform (https://scele.cs.ui.ac.id), a Moodle-based LMS used by Fakultas Ilmu Komputer, Universitas Indonesia. The tool scrapes course pages and presents assignments, quizzes, announcements, and forum discussions in a unified dashboard.

Implemented as a Chrome extension (Manifest V3) at the repo root. The legacy Tampermonkey userscript (`scele-summary.user.js`) is kept as a fallback but the extension is the primary form.

## File Structure (current)

```
manifest.json           -- MV3 manifest, host permissions for scele.cs.ui.ac.id

content/
  content.js            -- content script: injects 📋 Summary button on SCELE pages
  content.css           -- styles for the injected button

dashboard/
  dashboard.html        -- standalone dashboard page (loads all scripts)
  dashboard.js          -- shell: bootstrap, status bar, course picker, parseCourses, back button
  dashboard.css         -- all dashboard styles

features/               -- one file per feature, owns its scrape + render + UI logic
  assignments.js        -- parseActivities, detectStatus, enrichStatus, render table, fetch-all
  announcements.js      -- general-forums scraper + table render
  forums.js             -- learning-forums scraper + cards render + reply detection

lib/                    -- shared helpers used by 2+ features
  dates.js              -- parseMoodleDate, parseShortDate, formatDate, deadlineClass
  http.js               -- fetchText (credentials-included fetch wrapper)
  html.js               -- parseHtml, cleanText, escapeHtml, escapeAttr, shortenCourse
  forum-parser.js       -- parseForumDiscussions, parseForumsByCategory (shared by announcements + forums)
  storage.js            -- loadSelected, saveSelected (localStorage)
```

The architecture is hybrid: layer-based for shared helpers (`lib/`), feature-based for everything user-visible (`features/`). New features (Grades, Calendar Export, etc.) go in `features/`; only extract to `lib/` once a second feature needs the same code.

Scripts are loaded via plain `<script>` tags in `dashboard.html` — no ES modules. Load order: `lib/*` → `features/*` → `dashboard.js`. All functions live in shared global scope.

## Owners

Yahya Muhandar Fathana and Auriel Erich Ibrahim

## Current Features (v0.4)

### 1. Course Picker
- Fetches the SCELE homepage to discover all enrolled courses
- Courses are found via `.block_navigation a[href*="/course/view.php?id="]` inside `li.type_course` elements
- Grouped by category prefix (e.g. `[Reg]`, `[SI.Reg]`) extracted from course titles
- Quick buttons: Select all, Clear, Select current semester
- Selection saved to localStorage under key `scele-summary-selected-courses`
- Three feature buttons below: Assignments & Quizzes, Announcements, Forums
- Fetching only starts after user picks courses AND clicks a feature button

### 2. Assignments & Quizzes
- Fetches each selected course page (`/course/view.php?id={courseId}`)
- Scrapes `li.activity.assign` and `li.activity.quiz` elements
- Extracts name from `.instancename` (excluding `.accesshide` spans)
- Extracts deadlines from `[data-region="activity-dates"]` divs, matching `Due:`, `Closed:` (past), and `Closes:` (future). Moodle uses present tense for upcoming dates and past tense once they pass — both must be handled or upcoming quizzes show no deadline.
- Date parsing handles format: "Saturday, 14 February 2026, 11:55 PM"
- Sorted by deadline, newest first
- Status optimization: items with past deadlines are marked "Past" immediately (zero fetches). Only upcoming items get individual page fetches to check submission status.
- "Fetch all statuses" button available for checking past items
- Status detection for assignments: looks for "submitted for grading", "graded" (done) or "no attempt", "nothing has been submitted" (not done)
- Status detection for quizzes: looks for "your previous attempts", "highest grade" (done) or "no attempts have been made" (not done)

### 3. Announcements
- For each selected course, fetches `/mod/forum/index.php?id={courseId}`
- Finds forums under the "General forums" `<h2>` heading
- Parses forum links from the table using `a[href*="view.php?f="]`
- Fetches each general forum page, scrapes discussions
- Discussion links matched via `a.w-100.h-100.d-block[href*="discuss.php?d="]`
- Extracts: title, author (from `td.author`), date started (first `<time>` element in row)
- All posts merged across courses, sorted by date newest first

### 4. Forums (Learning Forums)
- Same scraping approach as announcements but targets "Learning forums" heading instead of "General forums"
- This catches weekly discussion forums, reflections, and any forum where lecturers post questions students must answer
- Displayed as cards: each forum is a card with forum name as header and course tag
- Empty forums show "No posts yet"
- Cards sorted by newest discussion date first, empty forums at bottom
- "Check my replies" button: detects current user ID from homepage (`/user/profile.php?id=` pattern), then fetches each discussion page and counts occurrences of the user's profile link. 2+ occurrences = replied (1 occurrence is just the navbar).
- Concurrency of 4 for reply checking

## Critical Technical Details

### Relative URLs
SCELE's forum pages use relative URLs in href attributes (e.g. `href="view.php?f=16094"` not the full `https://scele.cs.ui.ac.id/mod/forum/view.php?f=16094`). When parsing with DOMParser on a detached document, these don't resolve. Always use `getAttribute('href')` instead of `.href` property, and manually construct full URLs.

### Session/Authentication
The script relies on the user's existing SCELE session cookie. All fetch requests use `{ credentials: 'include' }`. The session typically lasts ~30 minutes after login. No credentials are stored or transmitted by the script.

### Moodle API
SCELE has the Moodle Web Service API disabled (`servicenotavailable` error). All data must be obtained via HTML scraping.

### Date Parsing
Forum discussion dates come in multiple formats. The parser tries three fallbacks:
1. `datetime` attribute on `<time>` elements (ISO format)
2. `data-timestamp` attribute (Unix seconds)
3. Visible text parsing (e.g. "22 Feb 2026")

Assignment/quiz dates use a different format: "Saturday, 14 February 2026, 11:55 PM" parsed via regex.

### User ID Detection
To check forum reply status, the script needs the current user's ID. It fetches the homepage and looks for `/user/profile.php?id=(\d+)` in the HTML, or `"userid"\s*:\s*(\d+)` in inline scripts.

## Extension Manifest Notes

- `manifest_version: 3`
- `host_permissions: ["https://scele.cs.ui.ac.id/*"]` (only SCELE, nothing else). No `cookies` permission needed — `fetch(..., {credentials: 'include'})` from the dashboard page automatically attaches the SCELE session cookie because of host_permissions.
- `content_scripts` injects the Summary button on `scele.cs.ui.ac.id` pages
- Dashboard page opened via `chrome.runtime.getURL('dashboard/dashboard.html')`
- `web_accessible_resources` exposes `dashboard/dashboard.html` to SCELE pages so the content script can open it
- No icons committed yet — Chrome falls back to the default puzzle-piece icon. Drop PNGs into `icons/` and add an `"icons"` field to manifest.json to brand it.

## Loading the Extension

chrome://extensions → enable Developer mode → "Load unpacked" → select the repo root. Reload the extension after pulling changes.

## URL Patterns Reference

| Purpose | URL Pattern |
|---------|-------------|
| Homepage (course discovery) | `https://scele.cs.ui.ac.id/` |
| Course page | `/course/view.php?id={courseId}` |
| Forums index | `/mod/forum/index.php?id={courseId}` |
| Forum view | `/mod/forum/view.php?f={forumId}` |
| Discussion | `/mod/forum/discuss.php?d={discussionId}` |
| Assignment | `/mod/assign/view.php?id={moduleId}` |
| Quiz | `/mod/quiz/view.php?id={moduleId}` |
| User profile | `/user/view.php?id={userId}` |
| User profile (alt) | `/user/profile.php?id={userId}` |

## Roadmap

### Short Term
- Test with a small group of students at Fasilkom UI
- Polish UI/UX based on feedback
- Add extension icons

### Medium Term
- Grade overview feature
- Deadline notifications (browser notifications)
- Calendar export (ICS)
- Course filtering within each feature (not just at picker level)

### Long Term
- Freemium model: free = assignments + announcements, paid = forums reply check + notifications + grade tracking
- Server-side payment verification
- Expand to EMAS UI (same Moodle platform, different subdomain)
- Generic Moodle support for other universities
- Publish on Chrome Web Store
- GitHub Action for auto-deployment to Chrome Web Store

## Development Notes

- The script currently has no external dependencies. All parsing uses native DOMParser and DOM APIs.
- Concurrency is capped at 4 parallel fetches to avoid overwhelming SCELE's server.
- Opera GX, Edge, and Brave all support Chrome extensions since they're Chromium-based.
- Chrome Web Store developer account: one-time $5 USD fee.