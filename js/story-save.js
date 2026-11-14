// Story speichern: erst Medien hochladen, dann das Dokument schreiben. Scheitert
// etwas, werden die neu hochgeladenen Dateien wieder geloescht. Entfernte Dateien
// einer bearbeiteten Story fallen erst nach dem erfolgreichen Speichern weg.
import { validateDraft, storagePath, storyPaths } from './story-logic.js?v=1';
import { uploadBlob, deleteFile } from './storage.js?v=1';
import { newStoryId, saveStory, deleteStoryDoc } from './stories-db.js?v=2';

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

export async function saveStoryWithMedia(uid, draft, { existing = null, io = defaultIo } = {}) {
  const error = validateDraft(draft);
  if (error) throw new Error(error);

  const storyId = existing?.id ?? io.newStoryId(uid);
  const uploaded = [];
  const upload = async (path, blob, type) => {
    await io.uploadBlob(path, blob, type);
    uploaded.push(path);
  };

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

    const data = {
      city: draft.city, country: draft.country ?? '', date: draft.date ?? null,
      text: draft.text ?? '', photos, voice, song: draft.song ?? null, shared: !!draft.shared
    };
    if (existing?.created_at !== undefined) data.created_at = existing.created_at;
    await io.saveStory(uid, storyId, data);

    const kept = new Set(storyPaths(data));
    for (const path of existing ? storyPaths(existing) : []) {
      if (!kept.has(path)) await io.deleteFile(path).catch(() => {});
    }
  } catch (e) {
    for (const path of uploaded) await io.deleteFile(path).catch(() => {});
    throw e;
  }
  return storyId;
}

export async function deleteStoryWithMedia(uid, story, { io = defaultIo } = {}) {
  for (const path of storyPaths(story)) await io.deleteFile(path);
  await io.deleteStoryDoc(uid, story.id);
}
