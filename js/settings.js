import { getLang, setLang } from './i18n.js?v=1';
import { getTheme, setTheme } from './theme.js?v=19';
import { signOutUser } from './auth.js?v=18';
import { APP_VERSION } from './version.js?v=1';

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

  // Theme — single toggle like the old header button (☀️ in dark, 🌙 in light)
  document.getElementById('settings-theme-toggle')?.addEventListener('click', () => {
    setTheme(getTheme() === 'light' ? 'dark' : 'light', map);
    _syncSelections();
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
    const lang     = getLang();
    const themeBtn = document.getElementById('settings-theme-toggle');
    if (themeBtn) themeBtn.textContent = getTheme() === 'light' ? '🌙' : '☀️';
    modal.querySelectorAll('#settings-lang .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.lang === lang));
  }
}
