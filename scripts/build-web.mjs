// Stages the shippable web app into dist/ for Capacitor (webDir: "dist").
//
// TravelMap has no bundler. Capacitor copies its whole webDir into the app
// bundle, so this script copies the repo root into dist/ and prunes it with
// BUNDLE_IGNORE below. That list is the single source of truth for what the
// app ships: add a pattern here and the app drops the file.
//
// It used to be read from hosting.ignore in firebase.json, back when Firebase
// Hosting served the same repo root. Since the web app was retired in favour
// of the App Store, Hosting serves landing/ instead, so firebase.json says
// nothing about the app bundle any more. Keep landing/** in the list, or the
// landing page rides along inside the app as dead weight.
//
// Usage: node scripts/build-web.mjs   (or: npm run build:web)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

// Glob patterns (Firebase Hosting syntax: **, *, ?) relative to the repo root.
const BUNDLE_IGNORE = [
  'firebase.json',
  '.firebaserc',
  '**/.*',
  '**/.*/**',
  'README.md',
  'docs/**',
  'app-logo.jpeg',
  'node_modules/**',
  'tests/**',
  'package.json',
  'package-lock.json',
  'vitest.config.js',
  'vitest.rules.config.js',
  'firestore.rules',
  'firestore.indexes.json',
  '**/*.log',
  'scripts/**',
  'dist/**',
  'ios/**',
  'capacitor.config.json',
  // The static landing page Firebase Hosting serves. Not part of the app.
  'landing/**'
];

// Glob -> RegExp for the subset used above: **, *, ?.
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

const ignore = BUNDLE_IGNORE.map(globToRegExp);
const isIgnored = rel => ignore.some(re => re.test(rel));

// dist/ must be in the ignore list, or it would copy itself on the next run.
if (!isIgnored('dist')) throw new Error('BUNDLE_IGNORE must contain "dist/**"');

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
