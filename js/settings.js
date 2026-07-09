import { getLang, setLang } from './i18n.js?v=1';
import { getTheme, setTheme } from './theme.js?v=18';
import { signOutUser } from './auth.js?v=18';
import { APP_VERSION } from './version.js?v=1';
// Note: theme.js is referenced as ?v=18 to match app.js until Task 7 bumps
// both references to ?v=19 in the same commit (same number everywhere,
// otherwise the module loads twice).

/** Wires the gear button, settings modal, theme/language switches,
 *  sign-out and version display. Call once after map init. */
export function setupSettings(map) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  document.getElementById('settings-version').textContent = `TravelMap v${APP_VERSION}`;

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    _syncSelections();
    modal.classList.add('open');
  });
  document.getElementById('settings-close')?.addEventListener('click', _close);
  modal.addEventListener('click', e => {
    if (e.target === modal) _close();
  });

  // Theme
  modal.querySelectorAll('#settings-theme .radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      setTheme(opt.dataset.theme, map);
      _syncSelections();
    });
  });

  // Language
  modal.querySelectorAll('#settings-lang .radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      setLang(opt.dataset.lang);
      _syncSelections();
    });
  });

  // Sign out
  document.getElementById('settings-signout')?.addEventListener('click', async () => {
    try { await signOutUser(); } catch { /* ignore */ }
    window.location.href = 'index.html';
  });

  function _close() {
    modal.classList.remove('open');
  }

  function _syncSelections() {
    const theme = getTheme();
    const lang  = getLang();
    modal.querySelectorAll('#settings-theme .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.theme === theme));
    modal.querySelectorAll('#settings-lang .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.lang === lang));
  }
}
