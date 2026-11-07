import { t, getLang, setLang } from './i18n.js?v=9';
import { getTheme, setTheme } from './theme.js?v=22';
import { signOutUser, linkedProviders, linkProvider } from './auth.js?v=24';
import { isNative } from './platform.js?v=1';
import { APP_VERSION } from './version.js?v=14';
import { openOverlay, closeOverlay } from './anim.js?v=2';
import { collectDeletionSummary, deleteAccount } from './account.js?v=6';
import { auth } from './config.js?v=3';
import { isOnline } from './net-status.js?v=1';
import { markLeaving, cancelLeaving, shutdownFirestore } from './firestore-shutdown.js?v=1';

/** Wires the gear button, settings modal, theme/language switches,
 *  sign-out and version display. Call once after map init. */
export function setupSettings(map) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  document.getElementById('settings-version').textContent = `TravelMap v${APP_VERSION}`;

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    _syncSelections();
    _renderProviders();
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
    markLeaving();
    await shutdownFirestore();
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
    if (!isOnline()) {
      delStatus.hidden = false;
      delStatus.textContent = t('delete.offline');
      return;
    }
    delConfirm.disabled = true;
    delStatus.hidden = false;
    delStatus.textContent = t('delete.working');
    try {
      markLeaving();
      await deleteAccount(uid);
      // Wie in Lumiq: Firestore beenden, den Cache des geloeschten Kontos
      // leeren und auch die native Google-Sitzung abmelden
      await shutdownFirestore({ clearCache: true });
      try { await signOutUser(); } catch { /* Konto ist ohnehin weg */ }
      localStorage.removeItem('tm-theme');
      localStorage.removeItem('tm-lang');
      localStorage.removeItem('tm-has-session');
      window.location.href = 'index.html';
    } catch (err) {
      cancelLeaving();
      console.error('Kontoloeschung fehlgeschlagen:', err);
      // Der Auth-Account existiert in jedem Fehlerfall noch, weil er zuletzt
      // faellt. Ein erneuter Versuch ist deshalb gefahrlos.
      delStatus.textContent = t('delete.failed');
      delConfirm.disabled = false;
    }
  });

  // ===== Anmeldemethoden =====
  // Google und Apple auf einem Konto. Wer sich bei Apple mit verborgener
  // E-Mail angemeldet hat, bekam ein zweites Konto; hier laesst sich der
  // jeweils andere Anbieter nachtraeglich anhaengen (js/auth.js).
  const PROVIDERS = [
    { id: 'google.com', name: 'Google' },
    { id: 'apple.com',  name: 'Apple', nativeOnly: true }
  ];
  const linkStatus = document.getElementById('settings-link-status');

  function _renderProviders() {
    const host = document.getElementById('settings-providers');
    if (!host) return;
    const linked = new Set(linkedProviders());
    host.innerHTML = '';
    if (linkStatus) linkStatus.hidden = true;
    PROVIDERS.forEach(({ id, name, nativeOnly }) => {
      if (nativeOnly && !isNative()) return;
      const row = document.createElement('div');
      row.className = 'settings-provider';
      const label = document.createElement('span');
      label.className = 'settings-provider-name';
      label.textContent = name;
      row.appendChild(label);
      if (linked.has(id)) {
        const ok = document.createElement('span');
        ok.className = 'settings-provider-linked';
        ok.textContent = `✓ ${t('settings.linked')}`;
        row.appendChild(ok);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'settings-provider-add';
        btn.textContent = t('settings.link');
        btn.addEventListener('click', () => _link(id, btn));
        row.appendChild(btn);
      }
      host.appendChild(row);
    });
  }

  async function _link(providerId, btn) {
    if (!linkStatus) return;
    if (!isOnline()) {
      linkStatus.hidden = false;
      linkStatus.textContent = t('toast.needsNetwork');
      return;
    }
    btn.disabled = true;
    linkStatus.hidden = true;
    try {
      await linkProvider(providerId);
      _renderProviders();
      linkStatus.hidden = false;
      linkStatus.textContent = t('link.done');
    } catch (err) {
      const code = String(err?.code ?? '');
      btn.disabled = false;
      if (code === 'auth/provider-already-linked') { _renderProviders(); return; }
      // Abbruch im Anbieter-Dialog ist kein Fehler
      if (/cancel|closed-by-user|user-cancelled|1001/i.test(code + ' ' + (err?.message ?? ''))) return;
      console.error('[TM] link provider failed:', err);
      linkStatus.hidden = false;
      linkStatus.textContent = code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'
        ? t('link.inUse') : t('link.failed');
    }
  }

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
