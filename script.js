if (!window.location.search.includes('v=')) {
    window.location.replace(window.location.href + '?v=' + Date.now());
}

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
    document.getElementById('currentDate').innerHTML =
        `${day}&thinsp;·&thinsp;${month}&thinsp;/&thinsp;${year}`;
}

updateDate();

const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

const SOURCES = [
    { label: 'Tagesschau',      tag: 'DE · INT · CENTER-LEFT',       url: 'https://www.tagesschau.de/xml/rss2/' },
    { label: 'ZDF',             tag: 'DE · INT · CENTER-LEFT',       url: 'https://www.zdf.de/rss/zdf/nachrichten' },
    { label: 'Deutsche Welle',  tag: 'DE · INT · CENTER-LEFT',       url: 'https://rss.dw.com/rdf/rss-de-all' },
    { label: 'Deutschlandfunk', tag: 'DE · INT · CENTER',            url: 'https://www.deutschlandfunk.de/die-nachrichten.353.de.rss' },
    { label: 'BBC World',       tag: 'EN · INT · CENTER',            url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { label: 'The Guardian',    tag: 'EN · INT · LEFT',              url: 'https://www.theguardian.com/world/rss' },
    { label: 'NPR World',       tag: 'US · INT · CENTER-LEFT',       url: 'https://feeds.npr.org/1004/rss.xml' },
];

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
    section.innerHTML = `
        <div class="titleRSS">
            <span class="source-label">${src.label}</span>
            <span class="dot">•</span>
            <span>${src.tag}</span>
        </div>
        <div class="feed" id="feed-${idx}">${skeletons()}</div>
    `;
    document.getElementById('feeds').appendChild(section);
}

async function loadFeed(src, idx) {
    const feedElement = document.getElementById(`feed-${idx}`);
    try {
        const res  = await fetch(PROXY + encodeURIComponent(src.url));
        const data = await res.json();
        if (data.status !== 'ok' || !data.items?.length) throw new Error();

        const items = data.items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        feedElement.innerHTML = items.map(item => `
            <a class="nachrichtenbox" href="${item.link || '#'}" target="_blank" rel="noopener">
                <span class="box-title">${item.title || '—'}</span>
                <span class="box-date">${relTime(item.pubDate)}</span>
            </a>
        `).join('');

    } catch {
        feedElement.innerHTML = `
            <div class="nachrichtenbox" style="justify-content:center;align-items:center;color:var(--muted);font-family:var(--mono);font-size:0.6rem;letter-spacing:0.12em;">
                FEED NICHT ERREICHBAR
            </div>`;
    }
}

SOURCES.forEach((src, i) => buildSection(src, i));
SOURCES.forEach((src, i) => loadFeed(src, i));