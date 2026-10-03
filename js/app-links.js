// Einladungslinks, die iOS direkt an die App durchreicht (Universal Links).
//
// Im Browser steht der Token in der Seiten-URL (map.html?token=...). In der
// iOS-App laeuft die Seite dagegen unter capacitor://localhost, der Link
// https://travel.marinpesa.dev/map.html?token=... kommt ueber das Capacitor
// App-Plugin an: beim Kaltstart als Start-URL (getLaunchUrl) und zusaetzlich
// als appUrlOpen-Ereignis, bei laufender App nur als Ereignis. Beide Wege
// landen hier, damit app.js und index.html nur noch einen Token sehen.
//
// Verbrauchte Link-URLs stehen im sessionStorage: die Start-URL bleibt fuer
// die ganze Prozesslaufzeit dieselbe, ohne Merker wuerde jeder Reload der
// Karte die Einladung erneut verarbeiten ("Ihr seid schon Freunde").
import { isNative } from './platform.js?v=1';

const CONSUMED_KEY = 'tm-consumed-app-links';

export function inviteTokenFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get('token') || null;
  } catch {
    return null;
  }
}

function defaultStorage() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

function consumed(storage) {
  try { return JSON.parse(storage?.getItem(CONSUMED_KEY) || '[]'); } catch { return []; }
}

/** Merkt sich die URL; false, wenn sie schon einmal verarbeitet wurde. */
function consume(url, storage) {
  const seen = consumed(storage);
  if (seen.includes(url)) return false;
  try { storage?.setItem(CONSUMED_KEY, JSON.stringify([...seen, url].slice(-20))); } catch { /* egal */ }
  return true;
}

async function defaultGetLaunchUrl() {
  return window.Capacitor.nativePromise('App', 'getLaunchUrl');
}

function defaultAddListener(plugin, event, cb) {
  return window.Capacitor.addListener(plugin, event, cb);
}

/**
 * Token aus der URL, mit der die App gestartet wurde, einmal pro Sitzung.
 * Im Browser immer null, dort steht der Token schon in location.search.
 */
export async function launchInviteToken({ native = isNative(), getLaunchUrl = defaultGetLaunchUrl, storage = defaultStorage() } = {}) {
  if (!native) return null;
  let url = null;
  try {
    url = (await getLaunchUrl())?.url ?? null;
  } catch (err) {
    console.error('[TM] getLaunchUrl failed:', err);
    return null;
  }
  const token = inviteTokenFromUrl(url);
  if (!token || !consume(url, storage)) return null;
  return token;
}

/** Ruft onToken(token) fuer jeden Einladungslink, der die laufende App erreicht. */
export function watchAppLinks(onToken, { native = isNative(), addListener = defaultAddListener, storage = defaultStorage() } = {}) {
  if (!native) return;
  try {
    addListener('App', 'appUrlOpen', data => {
      const url   = data?.url;
      const token = inviteTokenFromUrl(url);
      if (!token || !consume(url, storage)) return;
      onToken(token);
    });
  } catch (err) {
    console.error('[TM] appUrlOpen listener failed:', err);
  }
}
