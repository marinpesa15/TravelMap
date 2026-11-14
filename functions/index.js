// Callable searchSongs: Spotify-Suche mit Client-Credentials, die Zugangsdaten bleiben als Secrets serverseitig.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { mapTracks, tokenIsFresh } from './spotify-logic.js';

const clientId = defineSecret('SPOTIFY_CLIENT_ID');
const clientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');

let token = null; // { value, expiresAt } im Modulspeicher, gilt pro Instanz

async function getToken() {
  if (tokenIsFresh(token, Date.now())) return token.value;
  const basic = Buffer.from(`${clientId.value()}:${clientSecret.value()}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const json = await res.json();
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

export const searchSongs = onCall(
  { region: 'europe-west1', secrets: [clientId, clientSecret], maxInstances: 5 },
  async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const q = typeof request.data?.q === 'string' ? request.data.q.trim() : '';
    if (!q || q.length > 100) throw new HttpsError('invalid-argument', 'q must be 1 to 100 characters.');
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );
      if (!res.ok) throw new Error(`search ${res.status}`);
      return { songs: mapTracks(await res.json()).slice(0, 10) };
    } catch (e) {
      console.error('searchSongs failed', e.message);
      throw new HttpsError('unavailable', 'Song search is unavailable.');
    }
  }
);
