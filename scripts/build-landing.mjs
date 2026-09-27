// Copies the legal pages (and the assets they link relatively) from the repo
// root into landing/, the directory Firebase Hosting serves.
//
// privacy.html and support.html have two jobs. The iOS app links them
// relatively out of its bundle (dist/, staged by build-web.mjs from the repo
// root), and Apple's App Store forms point at travel.marinpesa.dev/privacy.html
// and /support.html, which Hosting serves from landing/. So the same file has
// to exist in both places, and the root stays the only place anyone edits.
//
// The copies in landing/ are checked in, and tests/landing-mirror.test.js goes
// red when they differ from the root. firebase.json also runs this script as a
// hosting predeploy step, so a deploy cannot ship a stale copy.
//
// Usage: node scripts/build-landing.mjs   (or: npm run build:landing)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything the legal pages reference relatively: the app stylesheet and the
// favicons. logo-mark.png and the icons are what the landing page uses too.
// manifest.webmanifest is left out on purpose: the landing page must not be
// installable as an app, the legal pages just get a harmless 404 for it.
export const MIRRORED = [
  'privacy.html',
  'support.html',
  'css/style.css',
  ...fs.readdirSync(path.join(root, 'icons')).filter(f => f.endsWith('.png')).sort().map(f => `icons/${f}`)
];

export function buildLanding() {
  for (const rel of MIRRORED) {
    const target = path.join(root, 'landing', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, rel), target);
  }
  return MIRRORED.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`landing/: ${buildLanding()} files mirrored from the repo root`);
}
