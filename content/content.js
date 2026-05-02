(function () {
    'use strict';

    if (window.__sceleSummaryInjected) return;
    window.__sceleSummaryInjected = true;

    const btn = document.createElement('button');
    btn.id = 'scele-summary-button';
    btn.textContent = '📋 Summary';
    btn.onclick = () => {
        const url = chrome.runtime.getURL('dashboard/dashboard.html');
        window.open(url, '_blank');
    };
    document.body.appendChild(btn);
})();
