import { getLang } from './i18n.js?v=9';
import { isNative } from './platform.js?v=1';
import { decideUpdate } from './update-logic.js?v=1';

// Single source of truth for the app version, shown in the settings modal and
// compared against the remote manifest below. Bump together with
// MARKETING_VERSION in the Xcode project on every release.
export const APP_VERSION = '1.6.0';

// The app ships inside the App Store bundle, so a newer version can only come
// from the store. landing/app-version.json on Firebase Hosting tells running
// clients what is live there (see js/update-logic.js for the rules). Update
// that file only once the new build is actually live in the App Store.
const MANIFEST_URL = 'https://travel.marinpesa.dev/app-version.json';
const APP_STORE_ID = '6814927672';
const STORE_URL_NATIVE = `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`;
const STORE_URL_WEB    = `https://apps.apple.com/app/id${APP_STORE_ID}`;

let _open = null;       // { kind, overlay } while a dialog is on screen
let _skipped = false;   // optional update dismissed — stays quiet until the next cold start
let _checking = false;

async function _fetchManifest() {
  const res = await fetch(`${MANIFEST_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function _check() {
  if (_checking) return;
  _checking = true;
  try {
    const manifest = await _fetchManifest();
    const decision = decideUpdate(APP_VERSION, manifest, getLang() === 'de' ? 'de' : 'en');
    if (!decision) return;
    if (decision.kind === 'optional' && _skipped) return;
    _show(decision);
  } catch {
    /* offline or manifest unreachable — the next start or resume retries */
  } finally {
    _checking = false;
  }
}

function _openStore() {
  if (isNative()) {
    // Capacitor hands non-web schemes to iOS, which opens the App Store app.
    window.location.href = STORE_URL_NATIVE;
  } else {
    window.open(STORE_URL_WEB, '_blank', 'noopener');
  }
}

function _close() {
  _open?.overlay.remove();
  _open = null;
}

// The few strings live here instead of i18n.js; adding keys there would force
// a ?v= bump across every i18n importer.
function _show({ kind, latest, notes }) {
  // A required prompt replaces an optional one; never stack two dialogs.
  if (_open) {
    if (_open.kind === 'required' || kind === 'optional') return;
    _close();
  }
  const de = getLang() === 'de';
  const required = kind === 'required';

  const overlay = document.createElement('div');
  overlay.className = 'update-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'update-card';

  const title = document.createElement('h3');
  title.textContent = required
    ? (de ? 'Update erforderlich' : 'Update required')
    : (de ? 'Neues Update verfügbar' : 'New update available');

  const body = document.createElement('p');
  body.textContent = required
    ? (de
        ? `TravelMap ${latest} ist da. Diese Version wird nicht mehr unterstützt, bitte aktualisiere die App, um weiterzumachen.`
        : `TravelMap ${latest} is here. This version is no longer supported, please update the app to continue.`)
    : (de
        ? `TravelMap ${latest} ist im App Store verfügbar. Du nutzt Version ${APP_VERSION}.`
        : `TravelMap ${latest} is available in the App Store. You are on version ${APP_VERSION}.`);

  card.append(title, body);

  if (notes) {
    const n = document.createElement('p');
    n.className = 'update-notes';
    n.textContent = notes;
    card.appendChild(n);
  }

  const actions = document.createElement('div');
  actions.className = 'update-actions';

  const updateBtn = document.createElement('button');
  updateBtn.type = 'button';
  updateBtn.className = 'update-primary';
  updateBtn.textContent = de ? 'Aktualisieren' : 'Update';
  updateBtn.addEventListener('click', () => {
    _openStore();
    // Optional: get out of the way. Required: stay up — returning to the app
    // without updating lands right back on this dialog.
    if (!required) _close();
  });

  if (!required) {
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'update-secondary';
    skipBtn.textContent = de ? 'Überspringen' : 'Skip';
    skipBtn.addEventListener('click', () => {
      _skipped = true;
      _close();
    });
    actions.appendChild(skipBtn);
  }
  actions.appendChild(updateBtn);

  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  _open = { kind, overlay };
}

/** Call once after app init: checks on every start and every return to the app. */
export function startUpdateCheck() {
  _check();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) _check();
  });
}
