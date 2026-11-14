// Story speichern: erst Medien hochladen, dann das Dokument schreiben. Auf die
// Server-Bestaetigung des Dokuments wird nie gewartet: bricht die Verbindung mitten im
// Speichern ab, kaeme sie nie, und das Formular bliebe gesperrt. Scheitert der Upload oder
// spaeter das Schreiben, werden die neu hochgeladenen Dateien wieder geloescht. Entfernte
// Dateien einer bearbeiteten Story fallen erst nach der Bestaetigung weg.
import { validateDraft, storagePath, storyPaths } from './story-logic.js?v=1';
import { uploadBlob, deleteFile } from './storage.js?v=2';
import { newStoryId, saveStory, deleteStoryDoc } from './stories-db.js?v=4';
import { settleWrite } from './offline-write.js?v=1';

const defaultIo = { uploadBlob, deleteFile, saveStory, deleteStoryDoc, newStoryId };

// Naechster freier Foto-Index, damit kein bestehender (auch kein gerade entfernter) Pfad ueberschrieben wird
function nextPhotoIndex(existing) {
  const used = (existing?.photos ?? []).map(p => /\/p(\d+)\.jpg$/.exec(p.path)?.[1]).filter(Boolean).map(Number);
  return used.length ? Math.max(...used) + 1 : 0;
}

// Nie auf einen Pfad hochladen, den die bestehende Story referenziert: scheitert das Speichern,
// bliebe sonst die alte Aufnahme zerstoert. Ohne bestehende Aufnahme gilt der Standardpfad.
function freeVoicePath(uid, storyId, existing) {
  const old = existing?.voice?.path;
  if (!old) return storagePath(uid, storyId, 'voice');
  let n = 1;
  while (`users/${uid}/stories/${storyId}/voice-${n}.m4a` === old) n++;
  return `users/${uid}/stories/${storyId}/voice-${n}.m4a`;
}

/**
 * Loest auf, sobald die Medien oben sind und das Dokument in der Warteschlange steht.
 * onWriteError: das Dokument wurde spaeter abgelehnt (Dateien sind dann schon aufgeraeumt).
 */
export async function saveStoryWithMedia(uid, draft, { existing = null, io = defaultIo, onWriteError = () => {} } = {}) {
  const error = validateDraft(draft);
  if (error) throw new Error(error);

  const storyId = existing?.id ?? io.newStoryId(uid);
  const uploaded = [];
  const cleanUp = async () => {
    for (const path of uploaded) await io.deleteFile(path).catch(() => {});
  };
  const upload = async (path, blob, type) => {
    await io.uploadBlob(path, blob, type);
    uploaded.push(path);
  };

  let data;
  try {
    let index = nextPhotoIndex(existing);
    const photos = [];
    for (const p of draft.photos) {
      if (p.blob) {
        const path = storagePath(uid, storyId, index++);
        await upload(path, p.blob, 'image/jpeg');
        photos.push({ path });
      } else {
        photos.push({ path: p.path });
      }
    }

    let voice = null;
    if (draft.voice?.blob) {
      const path = freeVoicePath(uid, storyId, existing);
      await upload(path, draft.voice.blob, 'audio/mp4');
      voice = { path, seconds: draft.voice.seconds };
    } else if (draft.voice) {
      voice = { path: draft.voice.path, seconds: draft.voice.seconds };
    }

    data = {
      city: draft.city, country: draft.country ?? '', date: draft.date ?? null,
      text: draft.text ?? '', photos, voice, song: draft.song ?? null, shared: !!draft.shared
    };
    if (existing?.created_at !== undefined) data.created_at = existing.created_at;
  } catch (e) {
    await cleanUp();
    throw e;
  }

  const written = io.saveStory(uid, storyId, data).then(async () => {
    const kept = new Set(storyPaths(data));
    for (const path of existing ? storyPaths(existing) : []) {
      if (!kept.has(path)) await io.deleteFile(path).catch(() => {});
    }
  }, async e => {
    await cleanUp();
    throw e;
  });
  // Wie offline: der lokale Stand ist sofort da, die Bestaetigung kommt irgendwann (oder nie)
  await settleWrite(written, { online: false, onError: onWriteError });
  return storyId;
}

/**
 * Dateien loeschen braucht Netz und wird abgewartet. Das Dokument wartet offline nicht
 * auf den Server (nur bei Stories ohne Dateien moeglich, der Aufrufer prueft das).
 */
export async function deleteStoryWithMedia(uid, story, { io = defaultIo, online = true, onWriteError } = {}) {
  for (const path of storyPaths(story)) await io.deleteFile(path);
  await settleWrite(io.deleteStoryDoc(uid, story.id), { online, onError: onWriteError });
}
