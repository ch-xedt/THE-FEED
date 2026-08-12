function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.add('light');
}

function updateDate() {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString('de-DE', { month: 'long' });
    const year = now.getFullYear();
    document.getElementById('currentDate').innerHTML = `${day}&thinsp;·&thinsp;${month}&thinsp;/&thinsp;${year}`;
    document.getElementById('github-link').innerHTML = `@ch-xedt ${year}`;
}
updateDate();

const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

const DEFAULT_SOURCES = [
    { label: 'Tagesschau',             tag: 'DE · INT · CENTER-LEFT',  url: 'https://www.tagesschau.de/xml/rss2/' },
    { label: 'ZDF',                    tag: 'DE · INT · CENTER-LEFT',  url: 'https://www.zdf.de/rss/zdf/nachrichten' },
    { label: 'Deutsche Welle',         tag: 'DE · INT · CENTER-LEFT',  url: 'https://rss.dw.com/rdf/rss-de-all' },
    { label: 'Deutschlandfunk',        tag: 'DE · INT · CENTER',       url: 'https://www.deutschlandfunk.de/die-nachrichten.353.de.rss' },
    { label: 'France24',               tag: 'FR · INT · CENTER',       url: 'https://www.france24.com/en/rss' },
    { label: 'BBC World',              tag: 'EN · INT · CENTER',       url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { label: 'The Guardian',           tag: 'EN · INT · LEFT',         url: 'https://www.theguardian.com/world/rss' },
    { label: 'NPR World',              tag: 'US · INT · CENTER-LEFT',  url: 'https://feeds.npr.org/1004/rss.xml' },
    { label: 'ABC News International', tag: 'US · INT · CENTER',       url: 'https://feeds.abcnews.com/abcnews/internationalheadlines' },
];

function loadState() {
    try {
        const raw = localStorage.getItem('feedState');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function saveState() {
    localStorage.setItem('feedState', JSON.stringify({
        order: state.order,
        disabled: state.disabled,    
        custom: state.custom          
    }));
}

const savedState = loadState();
const state = {
    order: savedState?.order || DEFAULT_SOURCES.map(s => s.url),
    disabled: new Set(savedState?.disabled || []),
    custom: savedState?.custom || [],
};


DEFAULT_SOURCES.forEach(s => {
    if (!state.order.includes(s.url)) state.order.push(s.url);
});

state.custom.forEach(s => {
    if (!state.order.includes(s.url)) state.order.push(s.url);
});

function getAllSources() {
    const map = {};
    DEFAULT_SOURCES.forEach(s => map[s.url] = { ...s, isCustom: false });
    state.custom.forEach(s => map[s.url] = { ...s, isCustom: true });
    return map;
}

function getActiveSources() {
    const map = getAllSources();
    return state.order
        .filter(url => map[url] && !state.disabled.has(url))
        .map(url => map[url]);
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function relTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date)) return '';
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 300)    return 'GERADE EBEN';
    if (diff < 3600)  return `VOR ${Math.floor(diff / 60)} MIN`;
    if (diff < 86400) return `VOR ${Math.floor(diff / 3600)} STD`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function skeletons(n = 6) {
    return Array.from({ length: n }, () => `
        <div class="skeleton-box">
            <div class="sk a"></div>
            <div class="sk b"></div>
            <div class="sk c"></div>
        </div>
    `).join('');
}

function buildSection(src, idx) {
    const section = document.createElement('div');
    section.className = 'RssSection';
    section.dataset.url = src.url;
    section.draggable = true;
    section.innerHTML = `
        <div class="titleRSS">
            <span class="drag-handle" title="Reihenfolge ändern">⠿</span>
            <span class="source-label">${escapeHtml(src.label)}</span>
            <span class="dot">•</span>
            <span>${escapeHtml(src.tag)}</span>
        </div>
        <div class="feed" id="feed-${idx}">${skeletons()}</div>
    `;
    document.getElementById('feeds').appendChild(section);
    setupDragEvents(section);
}

async function loadFeed(src, idx) {
    const feedElement = document.getElementById(`feed-${idx}`);
    if (!feedElement) return;
    try {
        const res = await fetch(PROXY + encodeURIComponent(src.url) + '&_=' + Date.now() * 1.5, { cache: 'no-store' });
        const data = await res.json();
        if (data.status !== 'ok' || !data.items?.length) throw new Error();

        const items = data.items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        feedElement.innerHTML = items.map(item => `
            <a class="nachrichtenbox" href="${escapeHtml(item.link || '#')}" target="_blank" rel="noopener">
                <span class="box-title">${escapeHtml(item.title || '—')}</span>
                <span class="box-date">${relTime(item.pubDate)}</span>
            </a>
        `).join('');
    } catch {
        feedElement.innerHTML = `
            <div class="nachrichtenbox" style="justify-content:center;align-items:center;color:var(--muted);font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;">
                FEED NICHT ERREICHBAR <br> (Neu laden oder @ch-xedt kontaktieren)
            </div>`;
    }
}

function renderAllFeeds() {
    const container = document.getElementById('feeds');
    container.innerHTML = '';
    const active = getActiveSources();
    active.forEach((src, i) => buildSection(src, i));
    active.forEach((src, i) => loadFeed(src, i));
}

let dragSrc = null;

function setupDragEvents(el) {
    el.addEventListener('dragstart', e => {
        dragSrc = el;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.RssSection').forEach(s => s.classList.remove('drag-over'));
        dragSrc = null;
        const newOrder = [...document.querySelectorAll('.RssSection')].map(s => s.dataset.url);
        const allUrls = Object.keys(getAllSources());
        const disabledUrls = allUrls.filter(u => state.disabled.has(u));
        state.order = [...newOrder, ...disabledUrls.filter(u => !newOrder.includes(u))];
        saveState();
    });
    el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrc && dragSrc !== el) {
            document.querySelectorAll('.RssSection').forEach(s => s.classList.remove('drag-over'));
            el.classList.add('drag-over');
            const container = document.getElementById('feeds');
            const siblings = [...container.querySelectorAll('.RssSection')];
            const srcIdx = siblings.indexOf(dragSrc);
            const tgtIdx = siblings.indexOf(el);
            if (srcIdx < tgtIdx) {
                el.after(dragSrc);
            } else {
                el.before(dragSrc);
            }
        }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
    });
}

function openSettings() {
    renderSourceToggles();
    renderCustomFeedList();
    document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings() {
    document.getElementById('settings-overlay').classList.remove('open');
    renderAllFeeds();
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('settings-overlay')) closeSettings();
}

function renderSourceToggles() {
    const container = document.getElementById('source-toggles');
    const map = getAllSources();
 
    const allUrls = [...state.order].filter(u => map[u]);

    container.innerHTML = allUrls.map(url => {
        const src = map[url];
        const isOn = !state.disabled.has(url);
        return `
        <div class="source-toggle-row">
            <div class="source-toggle-info">
                <span class="source-toggle-label">${escapeHtml(src.label)}</span>
                <span class="source-toggle-tag">${escapeHtml(src.tag)}</span>
            </div>
            <button class="toggle-btn ${isOn ? 'on' : 'off'}" data-url="${escapeHtml(url)}">
                ${isOn ? 'AN' : 'AUS'}
            </button>
        </div>`;
    }).join('');

    container.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleSource(btn.dataset.url));
    });
}

function toggleSource(url) {
    if (state.disabled.has(url)) {
        state.disabled.delete(url);
    } else {
        state.disabled.add(url);
    }
    saveState();
    renderSourceToggles();
}

function insertDot() {
    const input = document.getElementById('custom-tag');
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + '•' + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start + 1, start + 1);
}

function addCustomFeed() {
    const label = document.getElementById('custom-label').value.trim();
    const tag   = document.getElementById('custom-tag').value.trim();
    const url   = document.getElementById('custom-url').value.trim();
    const msg   = document.getElementById('add-feed-msg');

    if (!label || !url) {
        showMsg(msg, 'Name und URL sind erforderlich.', 'error');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showMsg(msg, 'Bitte eine gültige URL eingeben.', 'error');
        return;
    }

    // Duplikate überprüfen
    const allUrls = [...DEFAULT_SOURCES.map(s => s.url), ...state.custom.map(s => s.url)];
    if (allUrls.includes(url)) {
        showMsg(msg, 'Dieser Feed ist bereits vorhanden.', 'error');
        return;
    }

    const newSrc = { label, tag: tag || '—', url, isCustom: true };
    state.custom.push(newSrc);
    if (!state.order.includes(url)) state.order.push(url);
    saveState();

    document.getElementById('custom-label').value = '';
    document.getElementById('custom-tag').value = '';
    document.getElementById('custom-url').value = '';
    showMsg(msg, `„${label}" wurde hinzugefügt.`, 'ok');
    renderSourceToggles();
    renderCustomFeedList();
}

function removeCustomFeed(url) {
    const map = getAllSources();
    const src = map[url];
    openRemoveConfirm(url, src?.label);
}

function removeCustomFeedDirect(url) {
    state.custom = state.custom.filter(s => s.url !== url);
    state.order = state.order.filter(u => u !== url);
    state.disabled.delete(url);
    saveState();
    renderSourceToggles();
    renderCustomFeedList();
}

function renderCustomFeedList() {
    const container = document.getElementById('custom-feed-list');
    if (!state.custom.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="custom-list-label">EIGENE FEEDS</div>
        ${state.custom.map(s => `
            <div class="custom-feed-row">
                <div class="source-toggle-info">
                    <span class="source-toggle-label">${escapeHtml(s.label)}</span>
                    <span class="source-toggle-tag">${escapeHtml(s.url)}</span>
                </div>
                <button class="remove-btn" data-url="${escapeHtml(s.url)}">✕</button>
            </div>
        `).join('')}
    `;

    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeCustomFeed(btn.dataset.url));
    });
}

let confirmCallback = null;

function openConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
    document.getElementById('confirm-overlay').classList.remove('open');
    confirmCallback = null;
}

function handleConfirmOverlayClick(e) {
    if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('confirm-action-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        });
    }
});

function openResetConfirm() {
    openConfirm(
        'ALLES ZURÜCKSETZEN?',
        'Alle Custom Feeds werden gelöscht und alle Einstellungen auf Standard zurückgesetzt. Dies kann nicht rückgängig gemacht werden.',
        resetAll
    );
}

function resetAll() {
    localStorage.removeItem('feedState');
    state.order = DEFAULT_SOURCES.map(s => s.url);
    state.disabled = new Set();
    state.custom = [];
    saveState();
    renderSourceToggles();
    renderCustomFeedList();
    renderAllFeeds();
    closeSettings();
}

function openRemoveConfirm(url, label) {
    openConfirm(
        'FEED LÖSCHEN?',
        `Möchtest du „${label || 'den Feed'}" wirklich löschen?`,
        () => removeCustomFeedDirect(url)
    );
}

function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'add-feed-msg ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'add-feed-msg'; }, 3500);
}

renderAllFeeds();