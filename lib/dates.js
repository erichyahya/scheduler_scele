function parseMoodleDate(s) {
    const cleaned = s.replace(/^[A-Za-z]+,\s*/, '').trim();
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

function parseShortDate(s) {
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

function deadlineClass(ms, now) {
    if (!ms) return 'deadline-far';
    const days = (ms - now) / 86400000;
    if (days < 0) return 'deadline-past';
    if (days < 2) return 'deadline-soon';
    if (days < 7) return 'deadline-week';
    return 'deadline-far';
}
