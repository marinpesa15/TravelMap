import { t, getLang, setLang } from './i18n.js?v=2';
import { getTheme, setTheme } from './theme.js?v=19';
import { signOutUser } from './auth.js?v=20';
import { APP_VERSION } from './version.js?v=4';
import { openOverlay, closeOverlay } from './anim.js?v=1';
import { collectDeletionSummary, deleteAccount } from './account.js?v=2';
import { auth } from './config.js?v=1';

/** Wires the gear button, settings modal, theme/language switches,
 *  sign-out and version display. Call once after map init. */
export function setupSettings(map) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  document.getElementById('settings-version').textContent = `TravelMap v${APP_VERSION}`;

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    _syncSelections();
    openOverlay(modal);
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

  // ===== Kontoloeschung =====
  const delModal   = document.getElementById('delete-modal');
  const delStatus  = document.getElementById('delete-status');
  const delConfirm = document.getElementById('delete-confirm');

  document.getElementById('settings-delete')?.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !delModal) return;
    // Echte Zahlen statt abstrakter Kategorien. Wer loescht, soll sehen was weg ist.
    const s = await collectDeletionSummary(uid);
    document.getElementById('delete-summary').textContent = t('delete.summary', s);
    delStatus.hidden = true;
    delConfirm.disabled = false;
    openOverlay(delModal);
  });

  document.getElementById('delete-cancel')?.addEventListener('click', () => {
    closeOverlay(delModal);
  });

  delConfirm?.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (!navigator.onLine) {
      delStatus.hidden = false;
      delStatus.textContent = t('delete.offline');
      return;
    }
    delConfirm.disabled = true;
    delStatus.hidden = false;
    delStatus.textContent = t('delete.working');
    try {
      await deleteAccount(uid);
      localStorage.removeItem('tm-theme');
      localStorage.removeItem('tm-lang');
      localStorage.removeItem('tm-has-session');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Kontoloeschung fehlgeschlagen:', err);
      // Der Auth-Account existiert in jedem Fehlerfall noch, weil er zuletzt
      // faellt. Ein erneuter Versuch ist deshalb gefahrlos.
      delStatus.textContent = t('delete.failed');
      delConfirm.disabled = false;
    }
  });

  function _close() {
    closeOverlay(modal);
  }

  function _syncSelections() {
    const lang     = getLang();
    const themeBtn = document.getElementById('settings-theme-toggle');
    if (themeBtn) themeBtn.textContent = getTheme() === 'light' ? '🌙' : '☀️';
    modal.querySelectorAll('#settings-lang .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.lang === lang));
  }
}
