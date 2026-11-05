// Turns one repository (README, file tree, languages) into the record the pages are built from.
import { Marked } from 'marked';
import { parse } from 'node-html-parser';

const IGNORE_DIR = /(^|\/)(\.git|\.github|\.idea|\.vscode|node_modules|__pycache__|\.ipynb_checkpoints|\.venv|venv|env|target|dist|build|\.pytest_cache|\.mypy_cache|\.gradle|\.bsp|\.metals|\.bloop|\.next|coverage)(\/|$)/;
const IGNORE_FILE = /(^|\/)(\.[^/]+|.*\.pyc|.*\.class|.*\.o|Thumbs\.db)$/;
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;
const PICTO = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/gu;
const ACRONYMS = new Set(['ai', 'ml', 'dl', 'ufc', 'isis', 'sna', 'etl', 'api', 'sql', 'har', 'iot', 'gpu', 'cpu', 'nlp', 'ui', 'cv']);

export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const githubSlug = (s) => s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

export function humanize(name) {
  return name
    .replace(/([a-z]{2,})([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : /^[a-z]/.test(w) && w.length > 1 && /[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function plain(md) {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/[*_`~]+/g, '').replace(/\\\\/g, ' ').replace(/\\/g, '').replace(PICTO, '').replace(/\s+/g, ' ').trim();
}

function shorten(text, max = 230) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return end > 40 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

function chooseTitle(repo, h1, override) {
  if (override.title) return override.title;
  const human = humanize(repo.name);
  if (h1) {
    const head = h1.split(/\s:\s|:\s/)[0].replace(PICTO, '').trim();
    const words = human.toLowerCase().split(' ');
    const flat = head.toLowerCase();
    if (head.length <= 30 && words.every((w) => flat.includes(w))) return /\s/.test(head) || head.length < 14 ? head : humanize(head);
  }
  return human;
}

// ---------- README ----------
export function readReadme(md, ctx) {
  const tokens = new Marked().lexer(md || '');
  let h1 = null; let firstPara = null; let firstParaIndex = -1; let firstParaWhole = false;
  tokens.forEach((t, i) => {
    if (!h1 && t.type === 'heading' && t.depth === 1) h1 = plain(t.text);
    if (firstParaIndex < 0 && t.type === 'paragraph') {
      // prose only: drop "(see `path`)" asides and any sentence that is really a command or a path
      // and the sentence that only announces a list ("It compares three ways…:")
      const sentences = t.text.replace(/\([^)]*`[^)]*\)/g, '').split(/(?<=[.!?:])\s+/).filter((s) => !s.includes('`'));
      const prose = (sentences.length > 1 && /:\s*$/.test(sentences[sentences.length - 1]) ? sentences.slice(0, -1) : sentences).join(' ');
      const txt = plain(prose).replace(/\s+([.,;:])/g, '$1');
      if (txt.length > 40 && !/:$/.test(txt) && !/localhost|127\.0\.0\.1/.test(t.text)) { firstPara = txt; firstParaIndex = i; firstParaWhole = prose.replace(/\s+/g, " ").trim() === t.text.replace(/\s+/g, " ").trim(); }
    }
  });
  return { h1, firstPara, firstParaIndex, firstParaWhole, tokens };
}

export function renderReadme(tokens, { dropIndexes, resolve }) {
  const kept = tokens.filter((t, i) => !(t.type === 'heading' && t.depth === 1) && !dropIndexes.includes(i));
  const marked = new Marked({ gfm: true });
  const html = marked.parser(kept);
  const root = parse(`<div>${html}</div>`);
  root.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach((n) => n.remove());
  const headings = [];
  for (const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const level = Math.min(6, Number(h.tagName[1]) + (h.tagName === 'H1' ? 1 : 0));
    if (h.tagName === 'H1') h.tagName = 'h2';
    for (const n of h.childNodes) if (n.nodeType === 3) n.rawText = n.rawText.replace(PICTO, '');
    const text = h.text.trim();
    const id = githubSlug(h.text);
    h.setAttribute('id', 'readme-' + id);
    if (level === 2 && text) headings.push({ id: 'readme-' + id, text });
  }
  // strip pictographs from prose (not from code)
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) c.rawText = c.rawText.replace(PICTO, '');
      else if (c.tagName && !['PRE', 'CODE'].includes(c.tagName)) walk(c);
    }
  };
  walk(root);
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href.startsWith('#')) { a.setAttribute('href', '#readme-' + href.slice(1)); continue; }
    const r = resolve(href, 'link');
    a.setAttribute('href', r.href);
    if (r.pdf) a.setAttribute('data-pdf', r.pdf);
    if (/^https?:/.test(r.href) && !r.pdf) { a.setAttribute('rel', 'noopener'); a.setAttribute('target', '_blank'); }
  }
  for (const img of root.querySelectorAll('img[src]')) {
    img.setAttribute('src', resolve(img.getAttribute('src'), 'image').href);
    img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('alt')) img.setAttribute('alt', '');
  }
  // badges (shields etc.) add noise to a portfolio page
  for (const img of root.querySelectorAll('img')) if (/shields\.io|badge/i.test(img.getAttribute('src') || '')) { const p = img.parentNode; img.remove(); if (p && p.tagName === 'A' && !p.text.trim()) p.remove(); }
  for (const p of root.querySelectorAll('p')) if (!p.text.trim() && !p.querySelector('img')) p.remove();
  for (const t of root.querySelectorAll('table')) t.replaceWith(parse(`<div class="table-scroll">${t.toString()}</div>`));
  return { html: root.firstChild.innerHTML.trim(), headings };
}

// ---------- tree ----------
export function cleanTree(nodes) {
  return nodes.filter((n) => !IGNORE_DIR.test(n.path) && !(n.type === 'file' && IGNORE_FILE.test(n.path)));
}

export function treeStats(files) {
  const byExt = {};
  for (const f of files) { const ext = f.path.includes('.') ? f.path.split('.').pop().toLowerCase() : ''; byExt[ext] = (byExt[ext] || 0) + 1; }
  return { files: files.length, byExt };
}

function nest(nodes) {
  const root = { name: '', path: '', type: 'dir', children: [] };
  const map = new Map([['', root]]);
  const sorted = [...nodes].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const n of sorted) {
    const parentPath = n.path.split('/').slice(0, -1).join('/');
    const parent = map.get(parentPath);
    if (!parent) continue;
    const node = { name: n.path.split('/').pop(), path: n.path, type: n.type, children: n.type === 'dir' ? [] : undefined };
    parent.children.push(node);
    if (n.type === 'dir') map.set(n.path, node);
  }
  const count = (n) => (n.type === 'file' ? 1 : (n.files = n.children.reduce((s, c) => s + count(c), 0)));
  count(root);
  const order = (n) => { if (!n.children) return; n.children = n.children.filter((c) => c.type === 'file' || c.files > 0); n.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) : a.type === 'dir' ? -1 : 1)); n.children.forEach(order); };
  order(root);
  // compact single-folder chains: src/main/scala
  const compact = (n) => { if (!n.children) return; for (const c of n.children) { while (c.type === 'dir' && c.children.length === 1 && c.children[0].type === 'dir') { const only = c.children[0]; c.name = `${c.name}/${only.name}`; c.path = only.path; c.children = only.children; } compact(c); } };
  compact(root);
  return root;
}

// Picks which folders to open so the drawing stays readable: at most `maxLeaves` end points and
// `maxChildren` branches per folder; everything else is summarised as "folder · n files" or "+n more".
export function displayTree(nodes, repoName, { maxLeaves = 22, maxChildren = 8 } = {}) {
  const root = nest(nodes);
  root.name = repoName;
  const shown = (n) => {
    const kids = n.children;
    if (kids.length <= maxChildren) return { list: kids, more: 0 };
    return { list: kids.slice(0, maxChildren - 1), more: kids.length - (maxChildren - 1) };
  };
  const open = new Set([root]);
  const leaves = () => { let c = 0; const visit = (n) => { const { list, more } = shown(n); c += more ? 1 : 0; for (const k of list) { if (k.type === 'dir' && open.has(k)) visit(k); else c++; } }; visit(root); return c; };
  for (let changed = true; changed;) {
    changed = false;
    const candidates = [];
    const collect = (n, d) => { for (const k of shown(n).list) if (k.type === 'dir') { if (open.has(k)) collect(k, d + 1); else candidates.push({ k, d }); } };
    collect(root, 1);
    candidates.sort((a, b) => a.d - b.d || a.k.files - b.k.files);
    for (const { k, d } of candidates) {
      if (d > 4) continue;
      open.add(k);
      if (leaves() <= maxLeaves) { changed = true; break; }
      open.delete(k);
    }
  }
  const out = (n, depth) => {
    const node = { name: n.name, path: n.path, kind: n.type === 'dir' ? 'dir' : 'file' };
    if (n.type === 'dir') node.files = n.files;
    if (n.type === 'dir' && open.has(n)) {
      const { list, more } = shown(n);
      node.children = list.map((k) => out(k, depth + 1));
      if (more) node.children.push({ name: `+${more} more`, kind: 'more', path: n.path });
    }
    return node;
  };
  return out(root, 0);
}

// ---------- materials ----------
export function pickPdfs(files) {
  return files.filter((f) => /\.pdf$/i.test(f.path)).map((f) => {
    const name = f.path.split('/').pop();
    const base = name.replace(/\.pdf$/i, '');
    return { path: f.path, name, size: f.size, isReport: /report/i.test(f.path), title: humanize(base.replace(/[_-]+/g, ' ')) };
  }).sort((a, b) => Number(b.isReport) - Number(a.isReport) || a.path.localeCompare(b.path));
}

export function pickImages(files, readmeRefs) {
  const ok = (f) => IMAGE.test(f.path) && f.size > 6000 && f.size < 3_000_000;
  const byPath = new Map(files.map((f) => [f.path, f]));
  const out = [];
  const add = (f) => { if (f && ok(f) && !out.includes(f)) out.push(f); };
  readmeRefs.forEach((p) => add(byPath.get(p)));
  files.filter((f) => /(^|\/)docs?\//i.test(f.path)).forEach(add);
  files.filter((f) => /(logo|banner|cover|screenshot|diagram|architecture|schema|preview)/i.test(f.path.split('/').pop())).forEach(add);
  return out.slice(0, 3).map((f) => ({ path: f.path, name: f.path.split('/').pop() }));
}

// demo recordings kept in the repository (mp4/webm); a pair with the same name becomes one video
export function pickVideos(files) {
  const groups = new Map();
  for (const f of files) {
    const m = f.path.match(/^(.*)\.(mp4|webm)$/i);
    if (!m || f.size > 12_000_000 || f.size < 50_000) continue;
    const g = groups.get(m[1]) || { name: m[1].split('/').pop(), sources: [], size: 0 };
    g.sources.push({ path: f.path, type: `video/${m[2].toLowerCase()}` });
    g.size = Math.max(g.size, f.size);
    groups.set(m[1], g);
  }
  return [...groups.values()].sort((a, b) => b.size - a.size).slice(0, 2)
    .map((g) => ({ ...g, sources: g.sources.sort((a, b) => (a.type === 'video/webm' ? -1 : 1) - (b.type === 'video/webm' ? -1 : 1)) }));
}

// GitHub's language names → the files linguist counts for them (the languages these repositories use)
const LANG_FILES = {
  Python: /\.py$/i, 'Jupyter Notebook': /\.ipynb$/i, Scala: /\.(scala|sc|sbt)$/i, R: /\.(r|rmd)$/i,
  JavaScript: /\.(js|mjs|cjs|jsx)$/i, TypeScript: /\.tsx?$/i, HTML: /\.html?$/i, CSS: /\.css$/i, SCSS: /\.scss$/i,
  Java: /\.java$/i, Kotlin: /\.kts?$/i, 'C++': /\.(cpp|cc|cxx|hpp|hh)$/i, C: /\.[ch]$/i, Cuda: /\.cuh?$/i, Go: /\.go$/i, Rust: /\.rs$/i,
  Shell: /\.(sh|bash)$/i, SQL: /\.sql$/i, PLpgSQL: /\.sql$/i, TeX: /\.tex$/i,
  Dockerfile: /(^|\/)Dockerfile[^/]*$/, Makefile: /(^|\/)Makefile$/,
};

// Where each language lives in the repository: the folders (or, at the top level, the files) holding its
// files, most first. A repository that keeps everything under one folder (src/main/scala) is opened up
// until the folders say something.
export function languageUse(files, languages, max = 4) {
  return languages.map((name) => {
    const re = LANG_FILES[name];
    const paths = re ? files.map((f) => f.path).filter((p) => re.test(p)) : [];
    let base = '';
    for (let depth = 0; depth < 4 && paths.length; depth++) {
      const rest = paths.map((p) => p.slice(base.length));
      const first = new Set(rest.map((r) => r.split('/')[0]));
      if (first.size === 1 && rest.every((r) => r.includes('/'))) base += `${[...first][0]}/`; else break;
    }
    const count = new Map();
    for (const p of paths) { const r = p.slice(base.length); const i = r.indexOf('/'); const key = i < 0 ? r : r.slice(0, i + 1); count.set(key, (count.get(key) || 0) + 1); }
    const places = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max)
      .map(([key]) => ({ path: (base + key).replace(/\/$/, ''), label: base + key, kind: key.endsWith('/') ? 'dir' : 'file' }));
    return { name, places, more: Math.max(0, count.size - max) };
  });
}

export function detectDiscipline(override, topics, text, disciplines) {
  if (override.discipline && disciplines[override.discipline]) return override.discipline;
  for (const t of topics) if (disciplines[t]) return t;
  const hay = text.toLowerCase();
  let best = null; let bestScore = 0;
  for (const [id, d] of Object.entries(disciplines)) {
    const s = d.keywords.reduce((n, k) => n + (hay.split(k).length - 1), 0) + d.keywords.filter((k) => topics.includes(k.replace(/\s+/g, '-'))).length * 5;
    if (s > bestScore) { best = id; bestScore = s; }
  }
  return best || Object.keys(disciplines)[0];
}

// How much a repository says about the work this portfolio is for. Every part is a plain number kept
// in projects.json, so the order can be read back and tuned in site.config.json ("ranking", each
// discipline's "weight", a project's "boost"); "pin" still wins over the score.
export function relevance(p, { readme, disciplines, ranking, inCurriculum, boost = 0, now = Date.now() }) {
  const months = Math.max(0, (now - new Date(p.medianCommitAt || p.pushedAt)) / 2.63e9);
  // the portfolio's own subject: how many of its discipline's keywords the README uses, whatever the project's discipline
  const hay = (readme || '').toLowerCase();
  const focusHits = (disciplines[ranking.focus]?.keywords || []).filter((k) => hay.includes(k)).length;
  const parts = {
    discipline: disciplines[p.discipline]?.weight ?? 10,
    focus: Math.min(ranking.focusMax, focusHits * ranking.focusEach),
    award: p.award ? ranking.award : 0,
    curriculum: inCurriculum ? ranking.curriculum : 0,
    documentation: Math.min(8, p.headings.length * 1.5) + Math.min(6, (readme || '').length / 1500),
    documents: p.pdfs.length ? ranking.documents : 0,
    media: p.images.length || p.videos.length ? ranking.media : 0,
    size: Math.min(7, Math.log2(p.stats.files + 1)),
    recency: 10 * Math.exp(-months / 18),
    stars: Math.min(10, (p.stars || 0) * 2),
    fork: p.fork ? -ranking.fork : 0,
    boost,
  };
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k] * 10) / 10;
  return { score: Math.round(Object.values(parts).reduce((a, b) => a + b, 0) * 10) / 10, parts };
}

export { chooseTitle, plain, shorten };
