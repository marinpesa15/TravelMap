// Demo-Ersatz fuer Cloud Functions: die Song-Suche liefert nichts, Spotify wird nie gefragt.
export const getFunctions = () => ({});
export const httpsCallable = () => async () => ({ data: { songs: [] } });
