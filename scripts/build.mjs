// Step 3 of 3: write the static site into dist/ — one copy per language (English at /, Italian at
// /it/), with the PDFs, images and logos next to it.
//
//   BASE_PATH=/Portfolio node scripts/build.mjs   # when the site lives in a sub-folder (GitHub Pages)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeList, treeSvg } from './lib/tree.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const config = read('site.config.json');
const data = read('.data/projects.json');
const i18n = read('.data/i18n.json');
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const SITE_URL = (process.env.SITE_URL || config.site.url).replace(/\/$/, '');
const LANGS = config.site.languages; const DEF = config.site.defaultLanguage;
const LANG_NAME = { en: 'English', it: 'Italiano' };
// each language's country as a silhouette in the page's gold, not in flag colours: Great Britain and
// Northern Ireland, Italy with Sicily and Sardinia (Natural Earth 1:50m via world-atlas, public domain,
// fitted to a 24 × 24 box and simplified)
const LANG_SHAPE = {
  en: 'M12.8 18.9L11.9 19.5L10.5 19.1L10.7 18.8L10.3 18.6L9.5 18.9L9.2 18.6L9.1 18.1L10.5 17.2L10.9 16.6L10.7 15.6L9.9 15.9L10.5 15.0L11.7 14.5L12.1 14.7L12.2 14.3L12.6 14.6L12.2 14.1L12.5 12.5L12.0 12.5L11.5 11.7L11.6 10.9L12.2 10.4L9.4 10.9L9.2 10.3L9.9 9.0L9.6 8.1L10.0 7.9L9.7 7.4L9.1 8.0L9.3 7.3L8.8 7.8L8.4 9.5L9.1 5.8L8.5 6.4L7.8 6.0L8.4 5.6L8.6 4.6L8.2 4.1L8.6 3.8L8.3 3.5L8.5 3.0L9.2 3.0L8.8 2.5L8.9 2.0L9.4 2.0L9.4 1.2L11.0 1.2L12.2 1.1L12.0 1.8L10.9 2.8L11.1 3.1L10.7 3.7L11.7 3.4L13.6 3.4L14.1 3.9L12.9 6.3L11.8 6.8L12.5 6.7L12.8 7.1L11.8 7.7L11.1 7.5L13.5 8.0L14.2 8.9L14.8 11.1L16.5 12.6L16.3 12.8L16.8 13.9L15.7 13.6L16.2 13.6L17.0 14.5L17.1 15.0L16.7 15.6L17.0 15.9L17.4 15.5L18.4 15.6L19.1 16.5L18.5 18.4L17.7 18.6L17.9 19.0L17.2 19.3L18.7 19.6L18.6 20.0L17.0 21.1L15.5 21.1L14.6 20.8L14.4 21.1L13.7 21.2L13.7 21.5L12.3 21.2L11.7 21.4L11.3 22.4L10.6 22.1L9.2 23.0L8.5 22.9L10.6 20.0L12.1 20.0ZM7.6 12.6L7.0 12.7L6.5 11.8L6.0 12.5L5.3 12.3L4.9 11.7L5.4 11.3L5.2 11.1L5.7 10.9L6.0 10.2L6.6 9.8L7.8 9.8L8.4 10.8L8.1 11.2L8.6 11.2L8.7 11.6L8.4 11.5L8.5 12.2L7.9 12.7Z',
  it: 'M3.3 3.4L4.5 3.5L5.5 2.3L6.3 3.7L6.9 2.2L8.1 2.8L8.1 2.0L8.7 2.1L8.7 1.5L9.5 1.6L9.9 1.2L11.4 1.0L11.7 1.8L13.8 2.2L13.3 2.7L13.7 2.9L13.5 3.3L14.1 4.1L13.0 3.8L11.6 4.5L11.5 4.9L11.9 5.5L11.5 6.0L11.7 7.1L13.6 8.4L14.3 10.3L15.1 11.2L16.1 11.9L17.7 12.0L17.2 12.8L20.5 14.6L21.3 15.8L21.1 16.4L20.3 15.4L18.9 15.0L18.2 16.5L19.1 17.3L19.2 18.1L18.4 18.5L18.3 19.4L17.5 20.3L17.0 20.4L16.8 19.9L17.7 18.2L16.9 16.0L15.8 15.5L15.5 14.6L14.8 14.7L15.0 14.4L14.3 14.3L13.8 13.4L12.8 13.3L10.6 11.1L9.8 10.9L9.8 10.6L8.8 9.7L8.1 7.5L6.1 6.6L4.9 7.8L4.1 8.0L4.3 7.2L3.1 6.8L3.3 5.8L2.7 5.3L3.5 4.6L3.0 3.8ZM16.7 19.8L16.0 21.4L16.3 22.2L16.0 23.0L15.1 22.8L14.5 22.1L12.3 21.1L11.8 20.6L12.3 19.8L12.5 20.1L13.2 19.8L13.9 20.3ZM7.4 14.1L7.7 14.9L7.3 17.8L6.5 17.6L6.4 18.2L5.9 18.3L5.5 17.7L5.7 16.3L5.2 14.1L5.8 14.2L6.8 13.3Z',
};
const langShape = (l) => `<svg class="lang__shape" viewBox="0 0 24 24" aria-hidden="true"><path d="${LANG_SHAPE[l]}"/></svg>`;
// `hide: true` in site.config.json also works on data read before it was set
const projects = data.projects.filter((p) => !(config.projects?.[p.name] || {}).hide);
const contact = config.contact;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const prefix = (lang) => (lang === DEF ? '' : `/${lang}`);
const url = (lang, path = '') => `${BASE}${prefix(lang)}/${path}`;
const asset = (p) => `${BASE}/${p}`;

// ---------- files: copy, PDF covers and page counts ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, '.data/files'), join(DIST, 'files'), { recursive: true });
cpSync(join(ROOT, 'content/logos'), join(DIST, 'logos'), { recursive: true });
mkdirSync(join(DIST, 'files/cv'), { recursive: true });
cpSync(join(ROOT, 'content/cv', i18n[DEF].cv.pdf), join(DIST, 'files/cv', i18n[DEF].cv.pdf));
mkdirSync(join(DIST, 'assets'), { recursive: true });
const assetHash = {};
for (const f of readdirSync(join(ROOT, 'src'))) {
  const buf = readFileSync(join(ROOT, 'src', f));
  writeFileSync(join(DIST, 'assets', f), buf);
  assetHash[f] = createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

// PDF pages become JPEGs with poppler (what the Action installs) or, on a laptop without it,
// with Ghostscript and ImageMagick. `scaleTo` is the long side in pixels, as in pdftoppm.
const has = (cmd, arg) => { try { execFileSync(cmd, [arg], { stdio: 'ignore' }); return true; } catch { return false; } };
const pdfTool = has('pdftoppm', '-v') ? 'poppler' : has('gs', '--version') && has('convert', '-version') ? 'ghostscript' : null;
if (!pdfTool) console.warn('! neither pdftoppm nor gs + convert found: PDFs get no cover image');
function pdfInfo(file) {
  if (pdfTool === 'poppler') {
    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    return { pages: Number((info.match(/Pages:\s+(\d+)/) || [])[1]) || null, size: (info.match(/Page size:\s+([\d.]+) x ([\d.]+)/) || []).slice(1).map(Number) };
  }
  const n = execFileSync('gs', ['-q', '-dNODISPLAY', `--permit-file-read=${file}`, '-dBATCH', '-dNOPAUSE', '-c', `(${file.replace(/[()\\]/g, '\\$&')}) (r) file runpdfbegin pdfpagecount = quit`], { encoding: 'utf8' });
  return { pages: Number(n.trim()) || null, size: [] };
}
// writes `${out}.jpg` and returns its [width, height]
function pdfPage(file, page, scaleTo, quality, out) {
  if (pdfTool === 'poppler') execFileSync('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to', String(scaleTo), '-jpeg', '-jpegopt', `quality=${quality}`, '-singlefile', file, out]);
  else {
    execFileSync('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m', '-r150', `-dFirstPage=${page}`, `-dLastPage=${page}`, '-o', `${out}.png`, file]);
    execFileSync('convert', [`${out}.png`, '-resize', `${scaleTo}x${scaleTo}`, '-quality', String(quality), `${out}.jpg`]);
    rmSync(`${out}.png`);
  }
  return execFileSync('identify', ['-format', '%w %h', `${out}.jpg`], { encoding: 'utf8' }).split(' ').map(Number);
}
const coverSize = (size, rendered) => (size.length === 2 ? [900, Math.round((900 * size[1]) / size[0])] : rendered?.[0] ? [900, Math.round((900 * rendered[1]) / rendered[0])] : [900, 1273]);
for (const p of projects) {
  for (const d of p.pdfs) {
    const file = join(DIST, 'files', d.file);
    d.pages = null; d.cover = null; d.coverSize = null;
    if (!pdfTool) continue;
    try {
      const info = pdfInfo(file);
      d.pages = info.pages;
      const rendered = pdfPage(file, 1, 900, 80, file.replace(/\.pdf$/i, '-cover'));
      d.cover = d.file.replace(/\.pdf$/i, '-cover.jpg');
      d.thumbs = [];
      for (let pg = 2; pg <= Math.min(5, d.pages || 1); pg++) {
        pdfPage(file, pg, 420, 78, file.replace(/\.pdf$/i, `-p${pg}`));
        d.thumbs.push({ page: pg, src: d.file.replace(/\.pdf$/i, `-p${pg}.jpg`) });
      }
      d.coverSize = coverSize(info.size, rendered);
    } catch (e) { console.warn(`! ${d.file}: ${e.message}`); }
  }
}
// first page of the curriculum, shown next to the download
const CV_COVER = (() => {
  if (!pdfTool) return null;
  try {
    const file = join(DIST, 'files/cv', i18n[DEF].cv.pdf);
    const rendered = pdfPage(file, 1, 900, 82, file.replace(/\.pdf$/i, '-cover'));
    return { src: `cv/${i18n[DEF].cv.pdf.replace(/\.pdf$/i, '-cover.jpg')}`, size: coverSize(pdfInfo(file).size, rendered) };
  } catch { return null; }
})();

// image sizes, for width/height attributes
function imageSize(rel) {
  try {
    const out = execFileSync('identify', ['-format', '%w %h', join(DIST, 'files', rel) + '[0]'], { encoding: 'utf8' });
    return out.split(' ').map(Number);
  } catch { return [1200, 900]; }
}
// the colour at a picture's corner: a logo shown whole sits on it, so the frame around it does not show
function edgeColor(rel) {
  try { return execFileSync('convert', [join(DIST, 'files', rel) + '[0]', '-format', '%[hex:p{2,2}]', 'info:'], { encoding: 'utf8' }).trim().slice(0, 6); } catch { return null; }
}
for (const p of projects) for (const im of p.images) { im.size = imageSize(im.file); im.edge = edgeColor(im.file); }

// demo videos: a poster frame and the real proportions, when ffmpeg is installed
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
for (const p of projects) for (const v of p.videos || []) {
  v.size = [1600, 900]; v.poster = null;
  const mp4 = v.sources.find((x) => x.type === 'video/mp4') || v.sources[0];
  if (!hasFfmpeg) continue;
  try {
    const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(DIST, 'files', mp4.file)], { encoding: 'utf8' }).trim().split(',').map(Number);
    if (dims.length === 2 && dims[0]) v.size = dims;
    v.poster = mp4.file.replace(/\.[a-z0-9]+$/i, '-poster.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '3', '-i', join(DIST, 'files', mp4.file), '-frames:v', '1', '-vf', 'scale=1200:-2', '-q:v', '4', join(DIST, 'files', v.poster)]);
  } catch (e) { console.warn(`! ${mp4.file}: ${e.message}`); v.poster = null; }
}
const video = (t, v, cls = '') => `<figure class="vid ${cls}">
      <video muted loop playsinline autoplay preload="metadata" width="${v.size[0]}" height="${v.size[1]}"${v.poster ? ` poster="${asset(`files/${v.poster}`)}"` : ''}>${v.sources.map((x) => `<source src="${asset(`files/${x.file}`)}" type="${x.type}">`).join('')}</video>
      <button class="vid__toggle" type="button" data-pause="${esc(t['video.pause'])}" data-play="${esc(t['video.play'])}">${esc(t['video.pause'])}</button>
    </figure>`;

// ---------- shared pieces ----------
const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0c0a08"/><rect x="10" y="10" width="44" height="44" fill="#c9a45a"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#0c0a08">p0</text></svg>')}`;
const fmtDate = (lang, iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat(lang, opts).format(new Date(iso));
function period(lang, from, to, t) {
  const one = (v) => (!v ? t['cv.present'] : /^\d{4}$/.test(v) ? v : new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(new Date(`${v}-15`)));
  return `${one(from)} – ${one(to)}`;
}
const discColor = (id) => config.disciplines[id]?.color || 'stone';

function shell({ lang, t, title, description, path, main, bodyClass = '' }) {
  const other = LANGS.filter((l) => l !== lang);
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${url(l, path)}">`).join('');
  const langPref = lang === DEF ? `<script>try{var l=localStorage.getItem('lang');if(l&&l!=='${DEF}'&&${JSON.stringify(LANGS)}.indexOf(l)>-1)location.replace('${BASE}/'+l+'/${path}')}catch(e){}</script>` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0c0a08">
<link rel="canonical" href="${SITE_URL}${url(lang, path)}">
${alternates}<link rel="alternate" hreflang="x-default" href="${SITE_URL}${url(DEF, path)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${lang === 'it' ? 'it_IT' : 'en_GB'}">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600&amp;display=swap">
<link rel="stylesheet" href="${asset(`assets/styles.css?v=${assetHash['styles.css']}`)}">
<script>document.documentElement.classList.add('js')</script>
${langPref}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${esc(t['nav.skip'])}</a>
<header class="bar">
  <a class="bar__mark" href="${url(lang)}"${path === '' ? ' aria-current="page"' : ''}>Home</a>
  <nav class="bar__nav" aria-label="Main">
    <a href="${url(lang)}#repos"${path.startsWith('projects') ? ' aria-current="page"' : ''}>${esc(t['nav.projects'])}</a>
    <a href="${url(lang, 'cv/')}"${path === 'cv/' ? ' aria-current="page"' : ''}>${esc(t['nav.cv'])}</a>
    <span class="bar__contacts"><a href="mailto:${esc(contact.email)}" title="${esc(contact.email)}">Email</a>${contact.linkedin ? `<a href="${esc(contact.linkedin)}" rel="noopener">LinkedIn</a>` : ''}<a href="${esc(contact.github)}" rel="noopener">GitHub</a></span>
  </nav>
  <details class="lang">
    <summary aria-label="${esc(LANG_NAME[lang])}">${langShape(lang)}<span>${LANG_NAME[lang]}</span><svg class="lang__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></summary>
    <div class="lang__menu">${LANGS.map((l, i) => `<a href="${url(l, path)}" hreflang="${l}" lang="${l}" data-set-lang="${l}" style="--i:${i}"${l === lang ? ' aria-current="true"' : ''}>${langShape(l)}<span>${LANG_NAME[l]}</span><span class="lang__mark" aria-hidden="true">${l === lang ? '✓' : '→'}</span></a>`).join('')}</div>
  </details>
</header>
<main id="main">
${main}
</main>
${footer(lang, t)}
${viewer(t)}
<script src="${asset(`assets/site.js?v=${assetHash['site.js']}`)}" defer></script>
</body>
</html>
`;
}

function footer(lang, t) {
  return `<footer class="foot">
  <p>© ${new Date().getFullYear()} ${esc(i18n[lang].cv.name)} · ${esc(fmt(t['footer.synced'], { date: fmtDate(lang, data.generatedAt) }))}</p>
  <nav class="foot__links" aria-label="Footer">
    <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>${contact.linkedin ? `<a href="${esc(contact.linkedin)}" rel="noopener">LinkedIn</a>` : ''}<a href="${esc(contact.github)}" rel="noopener">GitHub</a><a href="#main">${esc(t['footer.top'])} ↑</a>
  </nav>
</footer>`;
}

function viewer(t) {
  return `<dialog class="viewer" aria-labelledby="viewer-title" data-loading="${esc(t['viewer.loading'])}" data-failed="${esc(t['viewer.failed'])}" data-pages-template="${esc(t['viewer.pages'])}">
  <div class="viewer__bar"><p id="viewer-title" class="viewer__title"></p><p class="viewer__pages tabular"></p><a class="viewer__download" download>${esc(t['project.download'])}</a><button class="viewer__close" type="button">${esc(t['viewer.close'])}</button></div>
  <div class="viewer__pages-wrap" tabindex="0"><p class="viewer__status"></p></div>
  <p class="viewer__fallback"><a target="_blank" rel="noopener">${esc(t['viewer.openTab'])}</a></p>
</dialog>`;
}

const lines = (a, b, cls = '') => `<span class="line"><span data-line style="--i:0"${cls}>${esc(a)}</span></span><span class="line"><span data-line style="--i:1">${esc(b)}</span></span>`;
function docTitle(t, d) { return d.isReport ? t['project.report'] : d.title; }

// ---------- home ----------
// the hero: one tile per project, in two arcs either side of the name. Each arc is a column, so a tile
// can never sit under the name or the button, however many projects there are; `--k` bends the column
// (the ends lean in) and `--r` tilts each tile along the curve.
function ring(lang, side, list, offset) {
  const m = list.length; const sign = side === 'left' ? 1 : -1;
  return list.map((p, k) => {
    const t = m > 1 ? (2 * k) / (m - 1) - 1 : 0;
    const style = `--k:${(t * t).toFixed(3)};--r:${(sign * t * 6).toFixed(1)}deg;--i:${offset + k};--side:${sign};--depth:${6 + ((offset + k) % 3) * 5}px`;
    const meta = [p.year, ...p.languages.slice(0, 2)].join(' · ');
    return `<li class="ring__item" style="${style}"><a class="tile--${discColor(p.discipline)}" href="${url(lang, `projects/${p.slug}/`)}" data-title="${esc(p.title)}" data-meta="${esc(meta)}"><span class="ring__title">${esc(p.title)}</span><span class="ring__meta">${esc(p.year)}</span></a></li>`;
  }).join('\n      ');
}

function home(lang) {
  const { ui: t, cv } = i18n[lang];
  const P = i18n[lang].projects;
  const [first, ...rest] = cv.name.split(' ');
  // around the name only the featured few (chosen in fetch.mjs, first in the list); the table has them all
  const featured = projects.filter((p) => p.featured);
  const half = Math.ceil(featured.length / 2);
  const orgs = [...cv.education.map((o) => ({ ...o, kind: 'education' })), ...cv.experience.map((o) => ({ ...o, kind: 'work' }))].filter((o) => o.logo);
  const orgTiles = orgs.map((o, i) => `<li class="orgs__item orgs__item--${o.kind}" data-reveal style="--i:${i}">
        <div class="tile logo-tile logo-tile--${o.tile}"><img src="${asset(`logos/${o.logo}`)}" alt="${esc(o.org)}" loading="lazy"><span class="orgs__kind">${esc(t[`home.kind.${o.kind}`])}</span></div>
        <p class="orgs__name">${esc(o.org)}</p><p class="orgs__role">${esc(o.title)}, ${esc(period(lang, o.from, o.to, t))}</p>
      </li>`).join('\n      ');
  const rows = projects.map((p, i) => `${i === featured.length ? `<li class="ptable__group" data-reveal>${esc(t['home.more'])}</li>
      ` : ''}<li class="ptable__row" data-reveal style="--i:${Math.min(i, 8)}">
        <a href="${url(lang, `projects/${p.slug}/`)}">
          <span class="ptable__title"><span class="swatch swatch--${discColor(p.discipline)}" aria-hidden="true"></span><span>${esc(p.title)}${p.parent ? `<span class="ptable__fork">${esc(fmt(t['home.forkOf'], { repo: p.parent.name }))}</span>` : ''}</span></span>
          <span class="ptable__desc">${esc(P[p.slug].description)}</span>
          <span class="ptable__langs">${esc(p.languages.join(' · '))}</span>
          <span class="ptable__year tabular">${p.year}</span>
          <span class="ptable__arrow" aria-hidden="true">→</span>
        </a>
      </li>`).join('\n      ');

  const main = `
  <section class="hero" aria-labelledby="hero-title">
    <ul class="ring ring--left" aria-label="${esc(t['home.ringHint'])}">
      ${ring(lang, 'left', featured.slice(0, half), 0)}
    </ul>
    <div class="hero__core">
      <h1 id="hero-title" class="hero__title lines" style="--fit:${Math.max(first.length, rest.join(' ').length)}">${lines(first, rest.join(' '))}</h1>
      <p class="hero__lede" data-load style="--d:420ms" data-default="${esc(t['home.lede'])}">${esc(t['home.lede'])}</p>
      <a class="button button--light" data-load style="--d:520ms" href="${url(lang, 'cv/')}">${esc(t['home.cta'])}</a>
      <p class="hero__contacts" data-load style="--d:620ms"><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>${contact.linkedin ? `<a href="${esc(contact.linkedin)}" rel="noopener">LinkedIn</a>` : ''}<a href="${esc(contact.github)}" rel="noopener">GitHub</a></p>
    </div>
    <ul class="ring ring--right" aria-label="${esc(t['home.ringHint'])}">
      ${ring(lang, 'right', featured.slice(half), half)}
    </ul>
  </section>

  <section class="about" aria-labelledby="about-title">
    <div class="about__text" data-reveal>
      <h2 id="about-title" class="head">${esc(t['home.about'])}</h2>
      <p class="lead">${esc(cv.summary)}</p>
      <p class="about__avail">${esc(cv.availability)}</p>
    </div>
    <h3 class="about__orgs">${esc(t['home.orgs'])}</h3>
    <ul class="orgs__grid">
      ${orgTiles}
    </ul>
    <a class="link link--gold" href="${url(lang, 'cv/')}">${esc(t['home.fullCv'])} →</a>
  </section>

  <section class="repos" id="repos" aria-labelledby="repos-title">
    <div class="repos__head">
      <h2 id="repos-title" class="head">${esc(t['home.repos'])}</h2>
      <p class="muted">${esc(t['home.reposNote'])}</p>
    </div>
    <div class="ptable">
      <p class="ptable__cols" aria-hidden="true"><span>${esc(t['home.col.project'])}</span><span>${esc(t['home.col.description'])}</span><span>${esc(t['home.col.languages'])}</span><span>${esc(t['home.col.year'])}</span></p>
      <ol class="ptable__rows">
      ${rows}
      </ol>
    </div>
  </section>`;
  return shell({ lang, t, title: `${cv.name} — ${cv.role}`, description: t['meta.description'], path: '', main, bodyClass: 'page-home' });
}

// ---------- project ----------
function project(lang, p, i) {
  const { ui: t } = i18n[lang];
  const P = i18n[lang].projects[p.slug];
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const blob = (n) => `https://github.com/${data.user}/${p.name}/${n.kind === 'file' ? 'blob' : 'tree'}/${p.branch}/${(n.path || '').split('/').map(encodeURIComponent).join('/')}`.replace(/\/$/, '');
  const docs = p.pdfs.map((d) => ({ ...d, href: asset(`files/${d.file}`), label: docTitle(t, d) }));
  const main0 = docs[0];
  const color = discColor(p.discipline);
  const readme = (P.readme || '').replaceAll('__BASE__', BASE);
  const desc = (P.description || '').replace(/…$/, '');
  const leadRest = P.lead && P.lead !== P.description ? (P.lead.startsWith(desc) ? P.lead.slice(desc.length).trim() : P.lead) : '';
  const toc = P.headings.length > 2 ? `<nav class="toc" aria-label="${esc(t['project.onThisPage'])}"><p class="toc__title">${esc(t['project.onThisPage'])}</p><ol>${P.headings.map((h) => `<li><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ol></nav>` : '';
  const others = docs.slice(1);
  const main = `
  <section class="phead board" aria-labelledby="ptitle">
    <div class="tile tile--surface phead__title" data-reveal>
      <h1 id="ptitle" class="display">${esc(p.title)}</h1>
      <p class="lead phead__desc">${esc(P.description)}</p>
    </div>
    <div class="tile tile--${color} phead__facts" data-reveal style="--i:1">
      ${p.tags.length ? `<ul class="tags" aria-label="${esc(t['project.tags'])}" translate="no">${p.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="phead__meta">
        ${p.award ? `<p class="phead__award">${esc(P.award)}</p>` : ''}
        ${p.parent ? `<p class="phead__fork">${fmt(esc(t['project.forkOf']), { repo: `<a href="${esc(p.parent.url)}" rel="noopener">${esc(p.parent.name)}</a>` })}</p>` : ''}
        <p>${esc(fmt(t['project.updated'], { date: fmtDate(lang, p.pushedAt) }))}</p>
        <a class="link" href="${esc(p.url)}" rel="noopener">${esc(t['project.github'])} ↗</a>
      </div>
    </div>
  </section>

  ${leadRest ? `<section class="plead"><p class="lead">${esc(leadRest)}</p></section>` : ''}

  ${p.languageUse.length ? `<section class="langs" aria-labelledby="langs-title">
    <div class="structure__head"><h2 id="langs-title" class="head">${esc(t['project.languages'])}</h2><p class="muted">${esc(t['project.languagesNote'])}</p></div>
    <dl class="langs__list">
      ${p.languageUse.map((l) => `<div class="langs__row" data-reveal><dt>${esc(l.name)}</dt><dd>${l.places.map((pl) => `<a href="${esc(blob({ kind: pl.kind, path: pl.path }))}" target="_blank" rel="noopener"><code>${esc(pl.label)}</code></a>`).join('')}${l.more ? `<span class="muted">${esc(fmt(t['project.languageMore'], { n: l.more }))}</span>` : ''}</dd></div>`).join('\n      ')}
    </dl>
  </section>` : ''}

  ${(p.videos || []).length ? `<section class="media" aria-labelledby="media-title">
    <h2 id="media-title" class="head">${esc(t['project.media'])}</h2>
    <div class="media__grid">
    ${p.videos.map((v) => video(t, v, v.size[0] >= v.size[1] ? 'vid--wide' : 'vid--tall')).join('\n    ')}
    </div>
  </section>` : ''}

  <section class="structure" aria-labelledby="structure-title">
    <div class="structure__head"><h2 id="structure-title" class="head">${esc(t['project.structure'])}</h2><p class="muted">${esc(t['project.structureNote'])}</p></div>
    ${treeSvg(p.tree, { href: blob, t })}
    ${treeList(p.tree, { href: blob, t })}
  </section>

  <section class="readme" aria-labelledby="readme-title">
    <h2 id="readme-title" class="head">${esc(t['project.readme'])}</h2>
    <div class="readme__grid">
      ${toc}
      <article class="prose${toc ? '' : ' prose--wide'}" lang="${lang}">${readme.trim() ? readme : `<p>${esc(t['project.noReadme'])}</p>`}</article>
    </div>
  </section>

  ${main0 ? `<section class="docs" aria-labelledby="docs-title">
    <div class="docs__main">
      ${main0.cover ? `<a class="docs__cover" href="${main0.href}" data-pdf="${main0.href}" data-pdf-title="${esc(`${p.title} — ${main0.label}`)}"><img src="${asset(`files/${main0.cover}`)}" alt="" width="${main0.coverSize[0]}" height="${main0.coverSize[1]}" loading="lazy"></a>` : ''}
      <div class="docs__text">
        <h2 id="docs-title" class="docs__title">${esc(main0.isReport ? t['project.report'] : t['project.documents'])}</h2>
        <p class="docs__meta">${esc(main0.path)}${main0.pages ? ` · ${esc(fmt(t['project.pages'], { n: main0.pages }))}` : ''}</p>
        <div class="docs__actions">
          <a class="button button--dark" href="${main0.href}" data-pdf="${main0.href}" data-pdf-title="${esc(`${p.title} — ${main0.label}`)}">${esc(t['project.read'])}</a>
          <a class="link" href="${main0.href}" download>${esc(t['project.download'])}</a>
        </div>
        ${(main0.thumbs || []).length ? `<ul class="docs__pages">${main0.thumbs.map((th) => `<li><a href="${main0.href}#page=${th.page}" data-pdf="${main0.href}" data-pdf-page="${th.page}" data-pdf-title="${esc(`${p.title} — ${main0.label}`)}"><img src="${asset(`files/${th.src}`)}" alt="${esc(`${main0.label}, ${th.page}`)}" width="420" height="${Math.round((420 * main0.coverSize[1]) / main0.coverSize[0])}" loading="lazy"></a></li>`).join('')}</ul>` : ''}
      </div>
    </div>
    ${others.length ? `<ul class="docs__others">${others.map((d) => `<li><a class="docs__other" href="${d.href}" data-pdf="${d.href}" data-pdf-title="${esc(`${p.title} — ${d.label}`)}">${d.cover ? `<img src="${asset(`files/${d.cover}`)}" alt="" width="${d.coverSize[0]}" height="${d.coverSize[1]}" loading="lazy">` : ''}<span>${esc(d.label)}${d.pages ? ` · ${esc(fmt(t['project.pages'], { n: d.pages }))}` : ''}</span></a></li>`).join('')}</ul>` : ''}
  </section>` : ''}

  <nav class="pnext board" aria-label="${esc(t['project.next'])}">
    <a class="tile tile--${discColor(next.discipline)} pnext__next" href="${url(lang, `projects/${next.slug}/`)}"><span class="pnext__name">${esc(next.title)}&nbsp;→</span><span class="pnext__label">${esc(t['project.next'])}</span></a>
    <a class="tile tile--surface pnext__prev" href="${url(lang, `projects/${prev.slug}/`)}"><span class="pnext__name pnext__name--small">←&nbsp;${esc(prev.title)}</span><span class="pnext__label">${esc(t['project.previous'])}</span></a>
  </nav>`;
  return shell({ lang, t, title: `${p.title} — Filippo Pizzo`, description: P.description, path: `projects/${p.slug}/`, main, bodyClass: 'page-project' });
}

// ---------- curriculum ----------
function curriculum(lang) {
  const { ui: t, cv } = i18n[lang];
  const pdf = asset(`files/cv/${cv.pdf}`);
  const bySlug = new Map(projects.map((p) => [p.name, p]));
  const row = (o, i) => `<li class="cvrow board" data-reveal style="--i:${i}">
      <div class="tile logo-tile logo-tile--${o.tile} cvrow__logo">${o.logo ? `<img src="${asset(`logos/${o.logo}`)}" alt="${esc(o.org)}" loading="lazy">` : `<span class="logo-tile__word">${esc(o.tile === 'stone' ? period(lang, o.from, o.to, t) : o.org)}</span>`}</div>
      <div class="tile tile--surface cvrow__body">
        <div class="cvrow__top"><h3 class="cvrow__org">${esc(o.org)}</h3><p class="cvrow__dates tabular">${esc(period(lang, o.from, o.to, t))}</p></div>
        <p class="cvrow__title">${esc(o.title)}</p>
        ${o.highlight ? `<p class="cvrow__hi">${esc(o.highlight)}</p>` : ''}
        <p class="cvrow__details">${esc(o.details)}</p>
      </div>
    </li>`;
  const skills = cv.skills.map((s, i) => `<div class="tile tile--${s.tile} cvskill" data-reveal style="--i:${i}"><h3 class="cvskill__group">${esc(s.group)}</h3><ul class="cvskill__items">${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('\n    ');
  const spoken = `<div class="tile tile--stone cvskill" data-reveal style="--i:${cv.skills.length}"><h3 class="cvskill__group">${esc(t['cv.spoken'])}</h3><ul class="cvskill__items">${cv.languages.map((l) => `<li>${esc(l.language)} <span class="cvskill__level">${esc(l.level)}</span></li>`).join('')}</ul></div>`;
  // awards: one tile each, the same size; a logo on top (the organisation's, or the one in the project's repository)
  const awards = cv.awards.map((a, i) => {
    const p = a.repo && bySlug.get(a.repo);
    const pic = p && p.images[0];
    const media = a.logo ? `<div class="cvaward__media cvaward__media--logo"><img src="${asset(`logos/${a.logo}`)}" alt="" loading="lazy"></div>`
      : pic ? `<div class="cvaward__media cvaward__media--image"${/^[0-9A-F]{6}$/i.test(pic.edge || '') ? ` style="background:#${pic.edge}"` : ''}><img src="${asset(`files/${pic.file}`)}" alt="" width="${pic.size[0]}" height="${pic.size[1]}" loading="lazy"></div>` : '';
    return `<article class="tile tile--surface cvaward" data-reveal style="--i:${i}">${media}<div class="cvaward__body">
        <p class="cvaward__event">${esc(a.event)}</p>
        <h3 class="cvaward__title">${esc(a.title)}</h3>
        <p class="cvaward__details">${esc(a.details)}</p>
        <p class="cvaward__about">${esc(a.about)}</p>
        <p class="cvaward__links">${p ? `<a class="link link--gold" href="${url(lang, `projects/${p.slug}/`)}">${esc(t['cv.seeProject'])} →</a>` : ''}${a.link ? `<a class="link" href="${esc(a.link.url)}" rel="noopener" target="_blank">${esc(a.link.label)} ↗</a>` : ''}</p>
      </div></article>`;
  }).join('\n    ');
  const main = `
  <section class="cvhead board" aria-labelledby="cv-title">
    <div class="tile tile--surface cvhead__title" data-reveal><h1 id="cv-title" class="display">${esc(t['cv.title'])}</h1><p class="lead">${esc(cv.summary)}</p><p class="cvhead__avail">${esc(cv.availability)}</p></div>
    ${CV_COVER ? `<a class="tile tile--white cvhead__cover" data-reveal style="--i:1" href="${pdf}" data-pdf="${pdf}" data-pdf-title="Filippo Pizzo — ${esc(t['cv.title'])}"><img src="${asset(`files/${CV_COVER.src}`)}" alt="" width="${CV_COVER.size[0]}" height="${CV_COVER.size[1]}"><span class="head__doc-tag">${esc(t['cv.download'])} ↓</span></a>`
    : `<a class="tile tile--gold cvhead__pdf" data-reveal style="--i:1" href="${pdf}" data-pdf="${pdf}" data-pdf-title="Filippo Pizzo — ${esc(t['cv.title'])}"><span>${esc(t['cv.download'])}</span><span class="arrow" aria-hidden="true">↓</span></a>`}
  </section>

  <section class="cvsec" aria-labelledby="edu-title">
    <h2 id="edu-title" class="head">${esc(t['cv.education'])}</h2>
    <ol class="cvlist">${cv.education.map(row).join('')}</ol>
  </section>

  <section class="cvsec" aria-labelledby="exp-title">
    <h2 id="exp-title" class="head">${esc(t['cv.experience'])}</h2>
    <ol class="cvlist">${cv.experience.map(row).join('')}</ol>
  </section>

  <section class="cvsec" aria-labelledby="skills-title">
    <h2 id="skills-title" class="head">${esc(t['cv.skills'])}</h2>
    <div class="board cvskills">
    ${skills}
    ${spoken}
    </div>
  </section>

  <section class="cvsec" aria-labelledby="rec-title">
    <h2 id="rec-title" class="head">${esc(t['cv.recognition'])}</h2>
    <div class="board cvawards">
    ${awards}
    </div>
  </section>`;
  return shell({ lang, t, title: `${t['cv.title']} — Filippo Pizzo`, description: cv.summary, path: 'cv/', main, bodyClass: 'page-cv' });
}

function notFound() {
  const t = i18n[DEF].ui;
  const main = `<section class="nf board"><div class="tile tile--surface nf__tile"><h1 class="display">${esc(t['notfound.title'])}</h1><p class="lead">${esc(t['notfound.text'])}</p><a class="button button--light" href="${url(DEF)}">${esc(t['notfound.back'])}</a></div></section>`;
  return shell({ lang: DEF, t, title: `${t['notfound.title']} — Filippo Pizzo`, description: t['notfound.text'], path: '', main, bodyClass: 'page-404' });
}

// ---------- write ----------
const write = (rel, html) => { const p = join(DIST, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); };
for (const lang of LANGS) {
  const dir = lang === DEF ? '' : `${lang}/`;
  write(`${dir}index.html`, home(lang));
  write(`${dir}cv/index.html`, curriculum(lang));
  projects.forEach((p, i) => write(`${dir}projects/${p.slug}/index.html`, project(lang, p, i)));
}
write('404.html', notFound());
write('.nojekyll', '');
const sitemap = LANGS.flatMap((l) => ['', 'cv/', ...projects.map((p) => `projects/${p.slug}/`)].map((path) => `<url><loc>${SITE_URL}${url(l, path)}</loc></url>`));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.join('')}</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}${BASE}/sitemap.xml\n`);
console.log(`built ${LANGS.length} languages × ${projects.length + 2} pages → dist/ (base "${BASE || '/'}")`);
if (!existsSync(join(DIST, 'index.html'))) process.exit(1);
