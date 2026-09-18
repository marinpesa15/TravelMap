// Stages the shippable web app into dist/ for Capacitor (webDir: "dist").
//
// TravelMap has no bundler; Firebase Hosting serves the repo root and filters
// it through hosting.ignore in firebase.json. Capacitor has no such filter and
// copies its whole webDir into the app bundle, so this script applies that
// exact ignore list. firebase.json stays the single source of truth for what
// ships: add a pattern there and both Hosting and the app drop the file.
//
// Usage: node scripts/build-web.mjs   (or: npm run build:web)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

const hosting = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8')).hosting;
if (hosting.public !== '.') {
  throw new Error(`build-web assumes hosting.public is ".", found "${hosting.public}"`);
}

// Glob -> RegExp for the subset firebase.json uses: **, *, ?.
// A trailing /** also matches the directory itself, so whole trees are pruned.
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('/**', i) && i + 3 === glob.length) { re += '(?:/.*)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const ignore = hosting.ignore.map(globToRegExp);
const isIgnored = rel => ignore.some(re => re.test(rel));

// dist/ must be in the ignore list, or it would copy itself on the next run.
if (!isIgnored('dist')) throw new Error('firebase.json hosting.ignore must contain "dist/**"');

fs.rmSync(out, { recursive: true, force: true });

const copied = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (isIgnored(rel)) continue;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!entry.isFile()) continue;
    fs.mkdirSync(path.join(out, dir), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(out, rel));
    copied.push(rel);
  }
}
walk('');

// js/config.js and js/constants.js are gitignored, so a fresh clone lacks
// them. Without them the app shell loads but nothing works; fail loudly.
const required = ['index.html', 'map.html', 'version.json', 'js/config.js', 'js/constants.js'];
const missing = required.filter(f => !copied.includes(f));
if (missing.length) {
  throw new Error(`dist/ is missing ${missing.join(', ')} (copy js/*.example.js and fill in real values)`);
}

const bytes = copied.reduce((sum, f) => sum + fs.statSync(path.join(out, f)).size, 0);
console.log(`dist/: ${copied.length} files, ${(bytes / 1e6).toFixed(2)} MB`);
