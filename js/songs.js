// Song-Suche ueber die Cloud Function searchSongs und die Spotify-Links der Story.
import { functions } from './config.js?v=4';
import { httpsCallable } from '../vendor/firebase/10.12.0/firebase-functions.js';

/** Sucht Songs, hoechstens 10 Treffer { id, title, artist, cover_url }. Wirft bei Fehler. */
export async function searchSongs(q) {
  const { data } = await httpsCallable(functions, 'searchSongs')({ q });
  return data?.songs ?? [];
}

export const embedUrl = id => `https://open.spotify.com/embed/track/${encodeURIComponent(id)}`;
export const openUrl = id => `https://open.spotify.com/track/${encodeURIComponent(id)}`;

// Cover kommt von aussen (auch aus Freundes-Stories): nur https wird als Bildquelle genommen
export const safeCover = url => (typeof url === 'string' && url.startsWith('https://') ? url : '');
