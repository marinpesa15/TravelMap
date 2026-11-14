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

/** Grenze der Storage-Rules fuer Fotos. */
export const MAX_JPEG_BYTES = 1000000;
const QUALITY_STEPS = [0.85, 0.7, 0.55];

/** Naechste niedrigere JPEG-Qualitaet, wenn ein Blob zu gross ist, sonst null (keine mehr uebrig). */
export function nextQuality(quality) {
  return QUALITY_STEPS.find(q => q < quality) ?? null;
}
