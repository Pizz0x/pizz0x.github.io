// Step 2 of 3: machine-translate everything the pages show into every language of the site.
// The interface and the curriculum are written in English (content/*.json); README files can be in
// any language and are translated both ways. Results are cached in .cache/translations.json, so only
// new or changed text is sent to the translator.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, decodeHtml, fillHtml, makeTranslator, segmentHtml } from './lib/translate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const config = read('site.config.json');
const ui = read('content/ui.json');
const cv = read('content/cv.json');
const data = read('.data/projects.json');
const LANGS = config.site.languages;
const BASE = config.site.defaultLanguage;
// curriculum fields that are names (people, organisations), dates, files, links or technology names
const KEEP = new Set(['name', 'org', 'logo', 'tile', 'from', 'to', 'repo', 'pdf', 'gpa', 'items', 'url']);

const tr = makeTranslator({ cacheFile: join(ROOT, '.cache/translations.json') });
console.log(`translator: ${tr.provider}`);

// text known to be in the site's base language → every other language
async function fromBase(texts) {
  const out = { [BASE]: texts };
  for (const lang of LANGS) if (lang !== BASE) out[lang] = (await tr.many(texts.map(escapeHtml), lang)).map((r) => decodeHtml(r.t));
  return out;
}

// HTML in an unknown language → every language (kept as is where it already is that language)
async function fromAny(segments) {
  const out = {}; const src = new Array(segments.length).fill('');
  const order = [...LANGS.filter((l) => l !== BASE), BASE];
  for (const lang of order) {
    const send = segments.map((s, i) => (lang === BASE && src[i] === BASE ? null : s));
    const idx = send.map((s, i) => (s === null ? -1 : i)).filter((i) => i >= 0);
    const res = await tr.many(idx.map((i) => segments[i]), lang);
    out[lang] = segments.slice();
    idx.forEach((i, k) => { out[lang][i] = res[k].src === lang ? segments[i] : res[k].t; if (!src[i]) src[i] = res[k].src; });
  }
  return { out, src };
}

// ---- interface ----
const uiKeys = Object.keys(ui);
const uiT = await fromBase(uiKeys.map((k) => ui[k]));

// ---- curriculum ----
const cvPaths = [];
const collect = (node, path) => {
  if (typeof node === 'string') { if (!KEEP.has(path[path.length - 1]) && !(path.includes('languages') && path[path.length - 1] === 'level' && /^[A-C][12]$/.test(node))) cvPaths.push([path, node]); return; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!KEEP.has(k)) collect(v, [...path, k]);
};
collect(cv, []);
// project and award titles are names: keep them
const cvList = cvPaths.filter(([p]) => !(p.includes('projects') && p[p.length - 1] === 'title'));
const cvT = await fromBase(cvList.map(([, v]) => v));

// ---- projects ----
const projT = {};
for (const lang of LANGS) projT[lang] = {};
for (const p of data.projects) {
  const seg = segmentHtml(p.readme || '');
  const simple = [p.description, p.lead || '', p.award || '', ...p.headings.map((h) => h.text)].map(escapeHtml);
  const all = [...simple, ...seg.segments];
  const { out, src } = await fromAny(all);
  const counts = {}; src.forEach((s) => { if (s) counts[s] = (counts[s] || 0) + 1; });
  const readmeLang = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || BASE;
  for (const lang of LANGS) {
    const t = out[lang]; const n = simple.length;
    projT[lang][p.slug] = {
      description: decodeHtml(t[0]), lead: p.lead ? decodeHtml(t[1]) : null, award: p.award ? decodeHtml(t[2]) : null,
      headings: p.headings.map((h, i) => ({ id: h.id, text: decodeHtml(t[3 + i]) })),
      readme: fillHtml(seg.template, t.slice(n)),
      translated: lang !== readmeLang, sourceLang: readmeLang,
    };
  }
  console.log(`- ${p.slug} (${readmeLang}, ${all.length} segments)`);
}

const result = {};
for (const lang of LANGS) {
  const cvOut = JSON.parse(JSON.stringify(cv));
  cvList.forEach(([path], i) => { let o = cvOut; for (const k of path.slice(0, -1)) o = o[k]; o[path[path.length - 1]] = cvT[lang][i]; });
  result[lang] = { ui: Object.fromEntries(uiKeys.map((k, i) => [k, uiT[lang][i]])), cv: cvOut, projects: projT[lang] };
}
writeFileSync(join(ROOT, '.data/i18n.json'), JSON.stringify(result, null, 2));
tr.save();
console.log(`done: ${tr.stats.sent} sent, ${tr.stats.cached} cached, ${tr.stats.failed} failed → .data/i18n.json`);
