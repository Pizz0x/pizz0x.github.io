// Step 1 of 3: read every public repository of the GitHub user and write .data/projects.json,
// plus the PDFs and images the pages show (.data/files/<project>/...).
//
//   GITHUB_TOKEN=... node scripts/fetch.mjs          # GitHub API (what the Action does)
//   LOCAL_REPOS=../clones node scripts/fetch.mjs     # a folder of git clones, for offline work
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubSource, localSource } from './lib/sources.mjs';
import {
  chooseTitle, cleanTree, detectDiscipline, displayTree, humanize, languageUse, pickImages, pickPdfs, pickVideos,
  readReadme, relevance, renderReadme, shorten, slugify, treeStats,
} from './lib/project.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const OUT = join(ROOT, '.data');
const FILES = join(OUT, 'files');

const user = config.github.user;
const source = process.env.LOCAL_REPOS
  ? localSource({ dir: process.env.LOCAL_REPOS, user })
  : githubSource({ user, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });

const exclude = new Set((config.github.exclude || []).map((s) => s.toLowerCase()));
const overrides = config.projects || {};
const ranking = { focus: 'data-engineering', focusEach: 2, focusMax: 10, award: 12, curriculum: 10, documents: 6, media: 4, fork: 8, ...config.ranking };
// repositories the curriculum names count as more relevant: they are the ones chosen for it
const cv = JSON.parse(readFileSync(join(ROOT, 'content/cv.json'), 'utf8'));
const inCurriculum = new Set([...(cv.projects || []), ...(cv.awards || [])].map((x) => x.repo).filter(Boolean));

function save(rel, buf) {
  const p = join(FILES, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  return rel;
}

function pdfText(path) {
  try { return execFileSync('pdftotext', ['-f', '1', '-l', '2', path, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return execFileSync('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=txtwrite', '-dFirstPage=1', '-dLastPage=2', '-o', '-', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
}

function pdfIntro(path) {
  try {
    const text = pdfText(path);
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      while (lines.length && (lines[0].length < 60 && !/[.!?]$/.test(lines[0]))) lines.shift();
      const para = lines.join(' ').replace(/\s+/g, ' ');
      if (para.length >= 140 && (para.match(/\.\s/g) || []).length >= 1) return para.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    }
  } catch { /* neither pdftotext nor gs installed */ }
  return null;
}

function fileName(name, taken) {
  const m = name.match(/^(.*?)(\.[a-z0-9]+)?$/i);
  let base = slugify(m[1]) || 'file'; const ext = (m[2] || '').toLowerCase();
  let out = base + ext; let i = 2;
  while (taken.has(out)) out = `${base}-${i++}${ext}`;
  taken.add(out);
  return out;
}

async function project(repo) {
  const ov = overrides[repo.name] || {};
  const slug = ov.slug || slugify(repo.name);
  const [rawTree, languages, medianAt, parent] = await Promise.all([source.tree(repo), source.languages(repo), source.medianCommitDate(repo), repo.fork ? source.parent(repo) : null]);
  const readme = await source.readme(repo, rawTree);
  const nodes = cleanTree(rawTree);
  const files = nodes.filter((n) => n.type === 'file');
  const readmeDir = readme ? posix.dirname(readme.path) : '.';
  const parsed = readReadme(readme?.text || '');

  // documents and pictures that live in the repository
  const taken = new Set();
  const pdfs = [];
  for (const p of pickPdfs(files)) {
    try { const local = `${slug}/${fileName(p.name, taken)}`; save(local, await source.file(repo, p.path)); pdfs.push({ ...p, file: local }); }
    catch (e) { console.warn(`  ! ${repo.name}: ${p.path}: ${e.message}`); }
  }
  const readmeImages = [...(readme?.text || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]+src=["']([^"']+)["']/g)]
    .map((m) => m[1] || m[2]).filter((s) => !/^https?:|^data:/.test(s)).map((s) => posix.normalize(posix.join(readmeDir, s.split(/[?#]/)[0])));
  const images = [];
  for (const im of pickImages(files, readmeImages)) {
    try { const local = `${slug}/img/${fileName(im.name, taken)}`; save(local, await source.file(repo, im.path)); images.push({ ...im, file: local }); }
    catch (e) { console.warn(`  ! ${repo.name}: ${im.path}: ${e.message}`); }
  }
  const videos = [];
  for (const v of pickVideos(files)) {
    try {
      const sources = [];
      for (const src of v.sources) { const local = `${slug}/video/${fileName(src.path.split('/').pop(), taken)}`; save(local, await source.file(repo, src.path)); sources.push({ file: local, type: src.type }); }
      videos.push({ name: v.name, path: v.sources[0].path, sources });
    } catch (e) { console.warn(`  ! ${repo.name}: ${v.name}: ${e.message}`); }
  }

  // README → HTML with links pointing at GitHub (or at our copy of a PDF)
  const pdfByPath = new Map(pdfs.map((p) => [p.path, p]));
  const blob = (p, kind) => `https://github.com/${repo.owner}/${repo.name}/${kind}/${repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
  const resolve = (href, as) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { href };
    const clean = href.split(/[?#]/)[0];
    const p = posix.normalize(posix.join(readmeDir, clean)).replace(/^\.\//, '').replace(/\/$/, '');
    if (as === 'image') return { href: `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}` };
    const pdf = pdfByPath.get(p);
    if (pdf) return { href: `__BASE__/files/${pdf.file}`, pdf: `__BASE__/files/${pdf.file}` };
    const isDir = nodes.some((n) => n.type === 'dir' && n.path === p);
    return { href: blob(p, isDir ? 'tree' : 'blob') };
  };
  const leadFromReadme = !ov.description && !repo.description && parsed.firstPara;
  const body = renderReadme(parsed.tokens, { dropIndexes: leadFromReadme && parsed.firstParaWhole ? [parsed.firstParaIndex] : [], resolve });

  // no prose in the README: the introduction of the project's own report says what it is
  const fromPdf = !ov.description && !repo.description && !parsed.firstPara && pdfs.length ? pdfIntro(join(FILES, pdfs[0].file)) : null;
  // a description written in site.config.json is shown whole; the others are cut to a short lead
  const description = ov.description || shorten(repo.description || parsed.firstPara || fromPdf || '');
  const MARKUP = new Set(['HTML', 'CSS', 'SCSS', 'TeX', 'Makefile', 'Dockerfile', 'Procfile', 'Batchfile']);
  const langs = Object.entries(languages).sort((a, b) => Number(MARKUP.has(a[0])) - Number(MARKUP.has(b[0])) || b[1] - a[1]).map(([k]) => k);
  const discipline = detectDiscipline(ov, repo.topics, `${readme?.text || ''} ${langs.join(' ')}`, config.disciplines);

  const record = {
    slug, name: repo.name, title: chooseTitle(repo, parsed.h1, ov), description,
    lead: leadFromReadme && parsed.firstParaWhole ? parsed.firstPara : null,
    url: repo.url, homepage: repo.homepage, fork: repo.fork, parent, branch: repo.branch, topics: repo.topics, stars: repo.stars,
    createdAt: repo.createdAt, pushedAt: repo.pushedAt, medianCommitAt: medianAt,
    // the year most of the work happened: the middle commit's, not the last push's
    year: new Date(medianAt || repo.pushedAt).getFullYear(),
    languages: langs.slice(0, 6), languageUse: languageUse(files, langs.slice(0, 6)), discipline, award: ov.award || null, pin: ov.pin ?? null,
    // GitHub topics when the repository has them, otherwise the ones listed in site.config.json
    tags: repo.topics.filter((t) => !t.startsWith('portfolio-')).map((t) => t.replace(/-/g, ' ')).concat(repo.topics.length ? [] : ov.tags || []),
    readme: body.html, headings: body.headings,
    stats: treeStats(files), tree: displayTree(nodes, repo.name),
    pdfs, images, videos,
  };
  record.relevance = relevance(record, { readme: readme?.text, disciplines: config.disciplines, ranking, inCurriculum: inCurriculum.has(repo.name), boost: ov.boost || 0 });
  return record;
}

// A closed-source project (`closed` in site.config.json): its repository is private, so nothing is read
// from it. The page is the text written by hand in `closed.file`, and the facts are in the config.
function closedProject(name, ov) {
  const c = ov.closed;
  const md = readFileSync(join(ROOT, c.file), 'utf8');
  const parsed = readReadme(md);
  const body = renderReadme(parsed.tokens, { dropIndexes: [], resolve: (href) => ({ href }) });
  const languages = c.languages || [];
  const now = new Date().toISOString();
  const record = {
    slug: ov.slug || slugify(ov.title || name), name, title: ov.title || parsed.h1 || humanize(name), description: ov.description || shorten(parsed.firstPara || ''),
    lead: null, closed: true, url: null, homepage: c.homepage || '', fork: false, parent: null, branch: null, topics: [], stars: 0,
    // still being worked on: the page is as recent as the last build
    createdAt: now, pushedAt: now, medianCommitAt: now, year: c.year || new Date().getFullYear(),
    languages, languageUse: [], discipline: detectDiscipline(ov, [], `${md} ${languages.join(' ')}`, config.disciplines),
    award: ov.award || null, pin: ov.pin ?? null, tags: ov.tags || [],
    readme: body.html, headings: body.headings,
    stats: { files: 0, byExt: {} }, tree: null, pdfs: [], images: [], videos: [],
  };
  // the page written by hand in another language too: translate.mjs uses it instead of a machine translation
  record.translations = Object.fromEntries(Object.entries(c.translations || {}).map(([lang, tr]) => {
    const page = renderReadme(readReadme(readFileSync(join(ROOT, tr.file), 'utf8')).tokens, { dropIndexes: [], resolve: (href) => ({ href }) });
    return [lang, { description: tr.description || null, readme: page.html, headings: page.headings }];
  }));
  record.relevance = relevance(record, { readme: md, disciplines: config.disciplines, ranking, inCurriculum: inCurriculum.has(name), boost: ov.boost || 0 });
  return record;
}
const closed = Object.entries(overrides).filter(([, ov]) => ov.closed && !ov.hide);

const repos = (await source.listRepos()).filter((r) =>
  !r.private && !r.archived && (config.github.includeForks || !r.fork) && !exclude.has(r.name.toLowerCase())
  && !r.topics.includes('portfolio-hide') && !(overrides[r.name] || {}).hide && !(overrides[r.name] || {}).closed);

rmSync(FILES, { recursive: true, force: true });
mkdirSync(FILES, { recursive: true });
const projects = [];
for (const repo of repos) {
  console.log(`- ${repo.name}`);
  projects.push(await project(repo));
}
for (const [name, ov] of closed) {
  console.log(`- ${name} (closed source, ${ov.closed.file})`);
  projects.push(closedProject(name, ov));
}
// pinned repositories first, in their order; then by relevance; ties go to the most recent push
projects.sort((a, b) => (a.pin ?? 99) - (b.pin ?? 99) || b.relevance.score - a.relevance.score || new Date(b.pushedAt) - new Date(a.pushedAt));
// the projects around the name: the first `home.featured` that are not marked "feature": false in
// site.config.json; they lead the table too, the others follow under "Other projects"
const featured = projects.filter((p) => (overrides[p.name] || {}).feature !== false).slice(0, Math.max(2, config.home?.featured ?? 6));
for (const p of projects) p.featured = featured.includes(p);
projects.sort((a, b) => Number(b.featured) - Number(a.featured));
const seen = new Map();
for (const p of projects) { const k = p.title.toLowerCase(); if (seen.has(k)) p.title = `${p.title} (${p.year})`; seen.set(k, p); }

writeFileSync(join(OUT, 'projects.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: source.kind, user, projects }, null, 2));
console.log(`${projects.length} projects → .data/projects.json`);
projects.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.title.padEnd(32)} ${p.pin ? 'pinned' : String(p.relevance.score).padStart(6)}${p.featured ? '  featured' : ''}`));
