// Pure decision logic for the "update available" prompt. No DOM, no network,
// so tests/update-logic.test.js can cover every case.
//
// The manifest lives on Firebase Hosting (landing/app-version.json):
//   { "latest": "1.7.0", "minimum": "1.6.0", "notes": { "de": "...", "en": "..." } }
//
//   latest   newest version live in the App Store
//   minimum  oldest version still allowed to run
//
// Rules:
//   current < minimum                  → 'required' (only "Update", no skip)
//   major(latest) > major(current)     → 'required' (a big release)
//   current < latest                   → 'optional' (Skip or Update)
//   otherwise                          → null (nothing to show)

/** "1.6.0" → [1, 6, 0]. Missing or non-numeric parts count as 0. */
export function parseVersion(v) {
  return String(v ?? '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map(p => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/** Negative when a < b, 0 when equal, positive when a > b. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const isVersion = v => typeof v === 'string' && /^\s*v?\d+(\.\d+)*\s*$/i.test(v);

/**
 * Decide which prompt, if any, to show.
 * @returns {null | { kind: 'optional' | 'required', latest: string, notes: string }}
 */
export function decideUpdate(current, manifest, lang = 'en') {
  if (!isVersion(current) || !manifest || typeof manifest !== 'object') return null;

  const latest  = isVersion(manifest.latest)  ? manifest.latest.trim()  : null;
  const minimum = isVersion(manifest.minimum) ? manifest.minimum.trim() : null;

  const notesObj = manifest.notes;
  const notes = typeof notesObj === 'string'
    ? notesObj
    : (notesObj && typeof notesObj === 'object'
        ? String(notesObj[lang] ?? notesObj.en ?? notesObj.de ?? '')
        : '');

  const below = v => v !== null && compareVersions(current, v) < 0;

  if (below(minimum)) {
    // A forced update always points at the newest build, never at the floor.
    const target = latest && compareVersions(latest, minimum) > 0 ? latest : minimum;
    return { kind: 'required', latest: target, notes };
  }
  if (below(latest)) {
    const bigRelease = parseVersion(latest)[0] > parseVersion(current)[0];
    return { kind: bigRelease ? 'required' : 'optional', latest, notes };
  }
  return null;
}
