import { getLang } from './i18n.js?v=8';

// Single source of truth for the app version, shown in the settings modal.
// Bump together with version.json on every release — running clients compare
// the two and offer a reload when they drift apart.
export const APP_VERSION = '1.4.1';

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

// Centered blocking dialog — updating is the only way forward, so there is
// deliberately no dismiss. The few strings live here instead of i18n.js;
// adding keys there would force a ?v= bump across every i18n importer.
function _showBanner() {
  if (_shown) return;
  _shown = true;
  const de = getLang() === 'de';

  const overlay = document.createElement('div');
  overlay.className = 'update-overlay';

  const card = document.createElement('div');
  card.className = 'update-card';

  const title = document.createElement('h3');
  title.textContent = de ? 'Update verfügbar' : 'Update available';

  const body = document.createElement('p');
  body.textContent = de
    ? 'Eine neue Version von TravelMap ist da. Lade neu, um sie zu verwenden.'
    : 'A new version of TravelMap is ready. Reload to use it.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = de ? 'Neu laden' : 'Reload';
  btn.addEventListener('click', () => location.reload());

  card.append(title, body, btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
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
