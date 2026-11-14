// Reine Spotify-Logik der Cloud Function (keine Imports, damit Vitest sie ohne functions/node_modules laedt).

// Kleinstes Cover mit mindestens 64 px Breite, sonst das kleinste vorhandene
function smallestCover(images) {
  const sized = (Array.isArray(images) ? images : []).filter(i => i && typeof i.url === 'string');
  const big = sized.filter(i => i.width >= 64).sort((a, b) => a.width - b.width);
  return (big[0] ?? sized.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0])?.url ?? '';
}

export function mapTracks(apiJson) {
  const items = apiJson?.tracks?.items;
  if (!Array.isArray(items)) return [];
  return items.filter(t => t && typeof t.id === 'string').map(t => ({
    id: t.id,
    title: String(t.name ?? ''),
    artist: (t.artists ?? []).map(a => a?.name).filter(Boolean).join(', '),
    cover_url: smallestCover(t.album?.images)
  }));
}

// Token gilt nur, wenn er noch mindestens 60 s haelt
export const tokenIsFresh = (token, nowMs) => !!token && token.expiresAt - 60000 > nowMs;
