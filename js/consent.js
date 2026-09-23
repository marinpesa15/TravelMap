import { t } from './i18n.js?v=8';
import { showToast } from './ui.js?v=39';
import { openOverlay, closeOverlay } from './anim.js?v=2';

// Bump this when the privacy policy changes materially —
// every user will then see the consent banner again.
export const CONSENT_VERSION = 1;

/** True if the loaded user doc contains an up-to-date consent. */
export function hasConsent(userData) {
  return (userData?.consent?.version ?? 0) >= CONSENT_VERSION;
}

/**
 * Shows the blocking consent banner.
 * onAccept: async fn that persists the consent (throws on failure).
 * Resolves true once onAccept succeeded, false if the user declined.
 * The banner cannot be dismissed any other way.
 */
export function requestConsent(onAccept) {
  return new Promise(resolve => {
    const banner  = document.getElementById('consent-banner');
    const accept  = document.getElementById('consent-accept');
    const decline = document.getElementById('consent-decline');

    openOverlay(banner);

    accept.onclick = async () => {
      accept.disabled = true;
      try {
        await onAccept();
        closeOverlay(banner);
        resolve(true);
      } catch (err) {
        console.error('Consent write failed:', err);
        showToast(t('toast.consentFailed'));
        accept.disabled = false;
      }
    };

    decline.onclick = () => {
      closeOverlay(banner);
      resolve(false);
    };
  });
}
