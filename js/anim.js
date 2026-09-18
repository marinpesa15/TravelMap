// Motion's UMD bundle, vendored. The +esm build on jsDelivr is only a stub
// that re-imports framer-motion/motion-dom from the CDN, so it can't be
// self-hosted. Imported for its side effect: the UMD sets globalThis.Motion.
import '../vendor/motion/12.43.0/motion.js';
const { animate, stagger } = globalThis.Motion;

// Central animation helpers (Motion / motion.dev).
// Everything animates transform + opacity only and respects
// prefers-reduced-motion: reduced users get instant state changes,
// the CSS fallbacks in style.css handle simple fades.

const EASE_OUT = [0.23, 1, 0.32, 1];

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Guards overlay open/close races: a close that finishes after a newer
// open must not hide the overlay again.
const _overlayTokens = new WeakMap();
function _bumpToken(el) {
  const t = (_overlayTokens.get(el) ?? 0) + 1;
  _overlayTokens.set(el, t);
  return t;
}

/** Opens a fullscreen overlay (adds .open) with backdrop fade + card scale. */
export function openOverlay(overlay) {
  if (!overlay) return;
  _bumpToken(overlay);
  const card = overlay.firstElementChild;
  if (reducedMotion()) {
    overlay.style.opacity = '';
    if (card) card.style.transform = '';
    overlay.classList.add('open');
    return;
  }
  // Set start states before .open makes the overlay visible — avoids a
  // one-frame flash at full opacity before Motion's first tick.
  overlay.style.opacity = '0';
  if (card) card.style.transform = 'scale(0.95)';
  overlay.classList.add('open');
  animate(overlay, { opacity: [0, 1] }, { duration: 0.18, ease: 'easeOut' });
  if (card) {
    animate(card, { transform: ['scale(0.95)', 'scale(1)'] }, { duration: 0.22, ease: EASE_OUT });
  }
  // Safety net: settle to the final state even if rAF stalled mid-open
  setTimeout(() => {
    overlay.style.opacity = '';
    if (card) card.style.transform = '';
  }, 300);
}

/** Closes an overlay (removes .open when done). Exit is faster than enter.
 *  Completion runs on a timer, not the animation promise — rAF stalls in
 *  backgrounded tabs (iOS PWA) and must never leave a dialog stuck open. */
export function closeOverlay(overlay, done) {
  if (!overlay) { done?.(); return; }
  const token  = _bumpToken(overlay);
  const finish = () => {
    if (_overlayTokens.get(overlay) !== token) return; // reopened meanwhile
    overlay.classList.remove('open');
    done?.();
  };
  if (reducedMotion()) { finish(); return; }
  const card = overlay.firstElementChild;
  if (card) animate(card, { transform: 'scale(0.97)' }, { duration: 0.14, ease: 'easeOut' });
  animate(overlay, { opacity: 0 }, { duration: 0.14, ease: 'easeOut' });
  setTimeout(finish, 160);
}

/** Quick scale/fade entrance for anchored popovers (city popup, country tooltip). */
export function popoverIn(el) {
  if (!el || reducedMotion()) return;
  animate(
    el,
    { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] },
    { duration: 0.15, ease: EASE_OUT }
  );
}

/** Counts a stat number from → to, writing rounded values into the element. */
export function countUp(el, to, from = 0, duration = 0.8) {
  if (!el) return;
  if (reducedMotion() || from === to) { el.textContent = to; return; }
  animate(from, to, {
    duration,
    ease: 'circOut',
    onUpdate: v => { el.textContent = Math.round(v); }
  });
  // Ensure the exact final value even if the tab is backgrounded mid-animation
  setTimeout(() => { el.textContent = to; }, duration * 1000 + 100);
}

/** Small scale pop when a stat ticks up after an add. */
export function popScale(el) {
  if (!el || reducedMotion()) return;
  animate(
    el,
    { transform: ['scale(1)', 'scale(1.22)', 'scale(1)'] },
    { duration: 0.3, ease: 'easeOut' }
  );
}

/** Toast enters from below with a slight overshoot. */
export function toastIn(el) {
  if (!el || reducedMotion()) return;
  animate(
    el,
    {
      transform: ['translate(-50%, 80px)', 'translate(-50%, -6px)', 'translate(-50%, 0px)'],
      opacity: [0, 1, 1]
    },
    { duration: 0.45, ease: EASE_OUT, times: [0, 0.7, 1] }
  );
}

/** Toast exits down, fast. */
export function toastOut(el) {
  if (!el || reducedMotion()) return;
  animate(
    el,
    { transform: 'translate(-50%, 60px)', opacity: 0 },
    { duration: 0.18, ease: 'easeIn' }
  );
}

/** New map marker drops in with a bounce. Animate an inner element, never the
 *  one Mapbox positions — Mapbox owns that element's transform. */
export function dropIn(el) {
  if (!el || reducedMotion()) return;
  animate(
    el,
    {
      transform: [
        'translateY(-60px) scale(0.6)',
        'translateY(0px) scale(1.15)',
        'translateY(0px) scale(0.94)',
        'translateY(0px) scale(1)'
      ],
      opacity: [0, 1, 1, 1]
    },
    { duration: 0.6, ease: EASE_OUT, times: [0, 0.55, 0.8, 1] }
  );
}

/** One-time staggered entrance for sidebar lists on app start. */
export function staggerIn(selector) {
  if (reducedMotion()) return;
  const els = document.querySelectorAll(selector);
  if (!els.length) return;
  animate(
    els,
    { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] },
    { duration: 0.26, ease: EASE_OUT, delay: stagger(0.045) }
  );
}

/** New list entry grows in (height + fade); siblings shift down smoothly. */
export function expandIn(el) {
  if (!el || reducedMotion()) return;
  const height = el.offsetHeight;
  if (!height) return;
  el.style.overflow = 'hidden';
  animate(
    el,
    { height: ['0px', `${height}px`], opacity: [0, 1] },
    { duration: 0.28, ease: EASE_OUT }
  );
  // Timer, not the animation promise — see closeOverlay
  setTimeout(() => {
    el.style.overflow = '';
    el.style.height   = '';
    el.style.opacity  = '';
  }, 320);
}
