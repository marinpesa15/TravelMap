// Reine Rechenhelfer fuer die Bildverarbeitung (js/image.js), ohne DOM testbar.

/** Lange Kante auf `max`, Seitenverhaeltnis bleibt, nie vergroessern, mindestens 1 px. */
export function fitSize(w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Mittiger quadratischer Ausschnitt. */
export function squareCrop(w, h) {
  const size = Math.min(w, h);
  return { sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2), size };
}
