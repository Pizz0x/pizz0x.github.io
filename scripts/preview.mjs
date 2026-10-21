// One command to look at the site on your own computer: reads the repositories (only the first
// time, or with --fresh), translates, builds dist/ and serves it at http://localhost:4321.
//
//   npm run preview                 # reuses .data/ when it exists
//   npm run preview -- --fresh      # reads GitHub again (60 API calls an hour without GITHUB_TOKEN)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (script) => {
  console.log(`\n→ ${script}`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.argv.includes('--fresh') || !existsSync(join(ROOT, '.data/projects.json'))) run('fetch.mjs');
else console.log('Using the repositories already read into .data/ (add -- --fresh to read GitHub again).');
run('translate.mjs');
run('build.mjs');
run('serve.mjs');
