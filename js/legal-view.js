// In-app viewer for the bundled legal pages (privacy.html, support.html).
//
// The links carry target="_blank" so the browser opens them in a new tab. In
// the native shell WKWebView asks Capacitor to create that new window, and
// Capacitor hands the URL to iOS as capacitor://localhost/privacy.html, which
// no app can open (LaunchServices error 115). The tap did nothing, also in
// 1.4.2 in the store. Navigating in place instead would tear down the map
// page (and needs shutdownFirestore first), so the page opens in an overlay
// with an iframe: the app keeps its state, the policy comes from the bundle
// and works offline. In the browser this module does nothing.

import { isNative } from './platform.js?v=1';
import { t } from './i18n.js?v=8';

const LEGAL_HREF = /^(privacy|support)\.html(#[\w-]*)?$/;

export function isBundledLegalHref(href) {
  return typeof href === 'string' && LEGAL_HREF.test(href);
}

// Delegated click handler, so links added later (dialogs, translations)
// are covered too. `open` is injectable for tests.
export function installLegalViewer({ doc = document, native = isNative(), open = openLegalViewer } = {}) {
  if (!native) return false;
  doc.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!isBundledLegalHref(href)) return;
    event.preventDefault();
    open(href);
  });
  return true;
}

const STYLE_ID = 'legal-viewer-style';
const VIEWER_ID = 'legal-viewer';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${VIEWER_ID} {
      position: fixed; inset: 0; z-index: 20000;
      display: flex; flex-direction: column;
      background: var(--bg-dialog, #0d1117);
    }
    #${VIEWER_ID} .legal-viewer-bar {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end;
      padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
      border-bottom: 1px solid var(--bd-dialog, rgba(255,255,255,0.1));
      background: var(--bg-dialog, #0d1117);
    }
    #${VIEWER_ID} .legal-viewer-close {
      padding: 8px 14px; border-radius: 10px; cursor: pointer;
      border: 1px solid var(--bd-card, rgba(255,255,255,0.06));
      background: var(--bg-card, rgba(255,255,255,0.04));
      color: var(--tx-primary, white); font: inherit; font-size: 0.9rem; font-weight: 600;
    }
    #${VIEWER_ID} iframe {
      flex: 1 1 auto; width: 100%; border: 0; background: transparent;
    }
  `;
  document.head.appendChild(style);
}

export function openLegalViewer(href) {
  closeLegalViewer();
  ensureStyle();

  const viewer = document.createElement('div');
  viewer.id = VIEWER_ID;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');

  const bar = document.createElement('div');
  bar.className = 'legal-viewer-bar';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'legal-viewer-close';
  close.textContent = t('dialog.close');
  close.addEventListener('click', closeLegalViewer);
  bar.appendChild(close);

  const frame = document.createElement('iframe');
  frame.src = href;
  frame.title = t('dialog.close');
  // The page's own "← TravelMap" link points at index.html, which inside the
  // frame would load the sign-in page. Same origin, so retarget it to close.
  frame.addEventListener('load', () => {
    try {
      const back = frame.contentDocument?.querySelector('.privacy-back');
      if (back) back.addEventListener('click', e => { e.preventDefault(); closeLegalViewer(); });
    } catch { /* not same-origin, leave it */ }
  });

  viewer.append(bar, frame);
  document.body.appendChild(viewer);
  return viewer;
}

export function closeLegalViewer() {
  document.getElementById(VIEWER_ID)?.remove();
}
