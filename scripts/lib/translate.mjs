// Machine translation with a cache. DeepL is used when DEEPL_API_KEY is set (best quality, free tier
// of 500,000 characters a month); otherwise Google's keyless web endpoint. Either way the source
// language is detected per segment, so an Italian README becomes English and an English one Italian.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'node-html-parser';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (target, text) => createHash('sha1').update(`${target}\n${text}`).digest('hex');

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const decodeHtml = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// keep code and {placeholders} out of the translator's hands
const protect = (html) => html
  .replace(/<code(\s|>)/g, '<code translate="no" class="notranslate"$1')
  .replace(/\{(\w+)\}/g, '<span translate="no" class="notranslate">{$1}</span>');
const unprotect = (html) => html
  .replace(/<span translate="no" class="notranslate">\s*\{(\w+)\}\s*<\/span>/g, '{$1}')
  .replace(/ translate="no" class="notranslate"/g, '')
  .replace(/(\}|<\/code>)\s+([.,;:!?)])/g, '$1$2');

async function google(texts, target) {
  const body = new URLSearchParams();
  texts.forEach((t) => body.append('q', t));
  const url = `https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=${target}&format=html`;
  const res = await fetch(url, { method: 'POST', body, headers: { 'User-Agent': 'Mozilla/5.0 (portfolio build)', 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`google ${res.status}`);
  let data = await res.json();
  if (texts.length === 1 && typeof data[0] === 'string') data = [data];
  return data.map((d) => (Array.isArray(d) ? { t: d[0], src: (d[1] || '').toLowerCase() } : { t: d, src: '' }));
}

async function deepl(texts, target, apiKey) {
  const host = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const res = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: target === 'en' ? 'EN-GB' : target.toUpperCase(), tag_handling: 'html', ignore_tags: ['code', 'pre'] }),
  });
  if (!res.ok) throw new Error(`deepl ${res.status}`);
  const data = await res.json();
  return data.translations.map((t) => ({ t: t.text, src: t.detected_source_language.toLowerCase().slice(0, 2) }));
}

export function makeTranslator({ cacheFile, deeplKey = process.env.DEEPL_API_KEY }) {
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const provider = deeplKey ? 'deepl' : 'google';
  const stats = { cached: 0, sent: 0, failed: 0 };

  async function call(batch, target) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return provider === 'deepl' ? await deepl(batch, target, deeplKey) : await google(batch, target); }
      catch (e) { if (attempt === 3) throw e; await sleep(1500 * 2 ** attempt); }
    }
  }

  // segments are HTML fragments; returns [{ t, src }] in the same order
  async function many(segments, target) {
    const out = new Array(segments.length);
    const todo = [];
    segments.forEach((s, i) => {
      if (!/[\p{L}]{2,}/u.test(s.replace(/<code[\s\S]*?<\/code>|<[^>]+>/g, ''))) { out[i] = { t: s, src: target }; return; }
      const hit = cache[key(target, s)];
      if (hit) { out[i] = { t: unprotect(hit.t), src: hit.src }; stats.cached++; } else todo.push(i);
    });
    const maxChars = provider === 'deepl' ? 25000 : 4000; const maxItems = provider === 'deepl' ? 50 : 40;
    for (let i = 0; i < todo.length;) {
      const batch = []; let chars = 0;
      while (i < todo.length && batch.length < maxItems && (chars + segments[todo[i]].length < maxChars || !batch.length)) { batch.push(todo[i]); chars += segments[todo[i]].length; i++; }
      try {
        const res = await call(batch.map((j) => protect(segments[j])), target);
        batch.forEach((j, k) => { cache[key(target, segments[j])] = res[k]; out[j] = { t: unprotect(res[k].t), src: res[k].src }; });
        stats.sent += batch.length;
      } catch (e) {
        console.warn(`  ! translation failed (${e.message}); keeping the original text for ${batch.length} segments`);
        batch.forEach((j) => { out[j] = { t: segments[j], src: '' }; });
        stats.failed += batch.length;
      }
      if (provider === 'google') await sleep(250);
    }
    return out;
  }

  return {
    provider, stats, many,
    save() { mkdirSync(dirname(cacheFile), { recursive: true }); writeFileSync(cacheFile, JSON.stringify(cache)); },
  };
}

// Splits an HTML document into translatable runs of inline content, leaving code blocks alone.
const INLINE = new Set(['A', 'ABBR', 'B', 'BR', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'IMG', 'INS', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR']);
const SKIP = new Set(['PRE', 'SCRIPT', 'STYLE', 'SVG', 'MATH']);

const VOID = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR']);

export function segmentHtml(html) {
  const root = parse(`<div>${html}</div>`);
  const segments = [];
  const inner = (el) => {
    let out = ''; let run = [];
    const flush = () => {
      if (!run.length) return;
      const htmlRun = run.map((n) => n.toString()).join('');
      run = [];
      if (!/\S/.test(htmlRun.replace(/<[^>]+>/g, ''))) { out += htmlRun; return; }
      const lead = htmlRun.match(/^\s*/)[0]; const trail = htmlRun.match(/\s*$/)[0];
      segments.push(htmlRun.trim());
      out += `${lead}⁣SEG${segments.length - 1}⁣${trail}`;
    };
    for (const n of el.childNodes) {
      if (n.nodeType === 3 || (n.nodeType === 1 && INLINE.has(n.tagName))) { run.push(n); continue; }
      flush();
      if (n.nodeType !== 1) { out += n.toString(); continue; }
      const open = `<${n.rawTagName}${n.rawAttrs ? ` ${n.rawAttrs}` : ''}>`;
      out += VOID.has(n.tagName) ? open : `${open}${SKIP.has(n.tagName) ? n.innerHTML : inner(n)}</${n.rawTagName}>`;
    }
    flush();
    return out;
  };
  return { template: inner(root.firstChild), segments };
}

export const fillHtml = (template, parts) => template.replace(/⁣SEG(\d+)⁣/g, (_, i) => parts[Number(i)]);
