import { getLang } from './i18n.js?v=1';

// Single source of truth for the app version, shown in the settings modal.
// Bump together with version.json on every release — running clients compare
// the two and offer a reload when they drift apart.
export const APP_VERSION = '1.1.0';

// There is no service worker, so an update arrives with a plain reload:
// HTML is served no-cache and every JS/CSS asset carries a ?v= version.
// This check tells already-running clients — especially the iOS standalone
// PWA, which resurrects old pages from memory — that a newer deploy exists.
const CHECK_EVERY_MS = 15 * 60 * 1000;
let _shown = false;

async function _check() {
  if (_shown) return;
  try {
    const res = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version && version !== APP_VERSION) _showBanner();
  } catch { /* offline — next round will retry */ }
}

// Two strings only, so they live here instead of i18n.js — adding keys there
// would force a ?v= bump across every i18n importer.
function _showBanner() {
  if (_shown) return;
  _shown = true;
  const de = getLang() === 'de';
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  const label = document.createElement('span');
  label.textContent = de ? 'Update verfügbar' : 'Update available';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = de ? 'Neu laden' : 'Reload';
  btn.addEventListener('click', () => location.reload());
  banner.append(label, btn);
  document.body.appendChild(banner);
}

/** Call once after app init. */
export function startUpdateCheck() {
  // Early check catches stale HTML that a PWA resume just resurrected
  setTimeout(_check, 5000);
  setInterval(_check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) _check();
  });
}
