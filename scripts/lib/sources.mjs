// Where the repositories come from. Both sources return the same shapes, so the rest of the
// pipeline does not care whether it runs in GitHub Actions (API) or on a laptop (local clones).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.github.com';

export function githubSource({ user, token }) {
  const headers = { 'User-Agent': 'pizz0x-portfolio', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function api(path, accept) {
    const res = await fetch(API + path, { headers: accept ? { ...headers, Accept: accept } : headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${await res.text()}`);
    return accept && accept.includes('raw') ? res.text() : res.json();
  }

  return {
    kind: 'github',
    async listRepos() {
      const repos = [];
      for (let page = 1; ; page++) {
        const batch = await api(`/users/${user}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
        repos.push(...batch);
        if (batch.length < 100) break;
      }
      return repos.map((r) => ({
        name: r.name, owner: r.owner.login, description: r.description || '', fork: r.fork, archived: r.archived,
        private: r.private, topics: r.topics || [], language: r.language, homepage: r.homepage || '',
        stars: r.stargazers_count, branch: r.default_branch, url: r.html_url,
        createdAt: r.created_at, pushedAt: r.pushed_at,
      }));
    },
    // found in the file tree (top level first, then docs/ and .github/, where GitHub looks too) and read from
    // raw.githubusercontent.com, so it costs no API request: without a token there are 60 an hour
    async readme(repo, tree) {
      const files = tree.filter((n) => n.type === 'file');
      const isReadme = (f, dir) => f.path.startsWith(dir) && /^readme(\.(md|markdown))?$/i.test(f.path.slice(dir.length));
      const path = ['', 'docs/', '.github/'].map((dir) => files.find((f) => isReadme(f, dir))).find(Boolean)?.path;
      return path ? { path, text: (await this.file(repo, path)).toString('utf8') } : null;
    },
    // the repository a fork comes from
    async parent(repo) {
      const r = await api(`/repos/${repo.owner}/${repo.name}`);
      return r?.parent ? { name: r.parent.full_name, url: r.parent.html_url } : null;
    },
    async tree(repo) {
      const t = await api(`/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(repo.branch)}?recursive=1`);
      if (!t) return [];
      return t.tree.filter((n) => n.type === 'blob' || n.type === 'tree').map((n) => ({ path: n.path, type: n.type === 'tree' ? 'dir' : 'file', size: n.size || 0 }));
    },
    async languages(repo) {
      return (await api(`/repos/${repo.owner}/${repo.name}/languages`)) || {};
    },
    // the date of the middle commit of the default branch: two requests, whatever the history's length
    // (the first page of one commit says, through its Link header, how many commits there are)
    async medianCommitDate(repo) {
      const page = (n) => fetch(`${API}/repos/${repo.owner}/${repo.name}/commits?sha=${encodeURIComponent(repo.branch)}&per_page=1&page=${n}`, { headers });
      const first = await page(1);
      if (!first.ok) return null;
      const total = Number(((first.headers.get('link') || '').match(/[?&]page=(\d+)>; rel="last"/) || [])[1]) || 1;
      const middle = Math.ceil(total / 2);
      const [commit] = middle === 1 ? await first.json() : await (await page(middle)).json();
      return commit?.commit?.author?.date || null;
    },
    async file(repo, path) {
      const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${encodeURIComponent(repo.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'pizz0x-portfolio' } });
      if (!res.ok) throw new Error(`raw ${url}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// Development source: a folder of git clones (one per repository). No topics or GitHub
// description are available, so the README and the overrides in site.config.json carry the page.
const EXT_LANG = { py: 'Python', ipynb: 'Jupyter Notebook', scala: 'Scala', r: 'R', js: 'JavaScript', ts: 'TypeScript', java: 'Java', cpp: 'C++', cc: 'C++', c: 'C', cu: 'Cuda', go: 'Go', rs: 'Rust', html: 'HTML', css: 'CSS', sql: 'SQL', sh: 'Shell' };

export function localSource({ dir, user }) {
  const git = (repoDir, ...args) => execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
  return {
    kind: 'local',
    async listRepos() {
      return readdirSync(dir).filter((d) => existsSync(join(dir, d, '.git'))).map((name) => {
        const p = join(dir, name);
        const date = git(p, 'log', '-1', '--format=%cI');
        const branch = git(p, 'rev-parse', '--abbrev-ref', 'HEAD');
        return { name, owner: user, description: '', fork: false, archived: false, private: false, topics: [], language: null, homepage: '', stars: 0, branch, url: `https://github.com/${user}/${name}`, createdAt: date, pushedAt: date };
      });
    },
    async readme(repo) {
      const p = join(dir, repo.name);
      const f = readdirSync(p).find((n) => /^readme(\.md|\.markdown)?$/i.test(n));
      return f ? { path: f, text: readFileSync(join(p, f), 'utf8') } : null;
    },
    async tree(repo) {
      const p = join(dir, repo.name);
      const files = git(p, 'ls-files').split('\n').filter(Boolean);
      const dirs = new Set();
      for (const f of files) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
      return [...[...dirs].map((d) => ({ path: d, type: 'dir', size: 0 })), ...files.map((f) => ({ path: f, type: 'file', size: statSync(join(p, f)).size }))];
    },
    async languages(repo) {
      const out = {};
      for (const n of await this.tree(repo)) {
        if (n.type !== 'file') continue;
        const lang = EXT_LANG[n.path.split('.').pop().toLowerCase()];
        if (lang) out[lang] = (out[lang] || 0) + n.size;
      }
      return out;
    },
    async parent() { return null; },
    async medianCommitDate(repo) {
      const dates = git(join(dir, repo.name), 'log', '--format=%aI').split('\n').filter(Boolean);
      return dates[Math.ceil(dates.length / 2) - 1] || null;
    },
    async file(repo, path) {
      return readFileSync(join(dir, repo.name, path));
    },
  };
}
