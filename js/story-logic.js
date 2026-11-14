// Reine Story-Logik (kein DOM, kein Firebase). Stories gehoeren zu einer
// besuchten Stadt, Schluessel ist der Stadtname.
export const LIMITS = { photos: 10, textChars: 2000, voiceSeconds: 120 };

// null wenn gueltig, sonst der Fehlercode. Datum allein zaehlt nicht als Inhalt.
export function validateDraft(draft) {
  const photos = draft.photos?.length ?? 0;
  if (!draft.text?.trim() && !photos && !draft.voice && !draft.song) return 'empty';
  if (photos > LIMITS.photos) return 'too-many-photos';
  if ((draft.text?.length ?? 0) > LIMITS.textChars) return 'text-too-long';
  if (draft.voice && draft.voice.seconds > LIMITS.voiceSeconds) return 'voice-too-long';
  return null;
}

// Zahl oder Firestore-Timestamp -> Millisekunden, fehlend -> null
const millis = x => (x == null ? null : x.toMillis?.() ?? Number(x));

// Datierte aufsteigend nach date, undatierte danach nach created_at.
export function sortStories(stories) {
  const key = s => {
    const d = millis(s.date);
    return d == null ? [1, millis(s.created_at) ?? 0] : [0, d];
  };
  return [...stories].sort((a, b) => {
    const [ga, va] = key(a), [gb, vb] = key(b);
    return ga - gb || va - vb;
  });
}

export function storyPages(story) {
  const photos = story.photos ?? [];
  return photos.length
    ? photos.map(p => ({ kind: 'photo', path: p.path }))
    : [{ kind: 'text' }];
}

export const citiesWithStories = stories => new Set(stories.map(s => s.city));

export const storyPaths = story =>
  [...(story.photos ?? []).map(p => p.path), story.voice?.path].filter(Boolean);

export const storagePath = (uid, storyId, index) =>
  `users/${uid}/stories/${storyId}/${index === 'voice' ? 'voice.m4a' : `p${index}.jpg`}`;

export function orphanStories(stories, userData) {
  const visited = new Set((userData?.visited_cities ?? []).map(c => c.name));
  return stories.filter(s => !visited.has(s.city));
}
