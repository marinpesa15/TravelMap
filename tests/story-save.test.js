import { describe, it, expect } from 'vitest';
import { saveStoryWithMedia, deleteStoryWithMedia } from '../js/story-save.js';

const B = { size: 1 };
const flush = () => new Promise(r => setTimeout(r, 0));
const draft = over => ({ city: 'Wien', country: 'Oesterreich', date: null, text: '', photos: [], voice: null, song: null, shared: false, ...over });

function fakeIo({ failUploadAt = -1, failSave = false, hangSave = false, hangDeleteDoc = false } = {}) {
  const io = {
    calls: [],
    saved: undefined,
    newStoryId: () => 'new1',
    uploadBlob: async path => {
      io.calls.push(['upload', path]);
      if (io.calls.filter(c => c[0] === 'upload').length - 1 === failUploadAt) throw new Error('upload-failed');
    },
    deleteFile: async path => { io.calls.push(['delete', path]); },
    saveStory: async (uid, id, data) => {
      io.calls.push(['save', id]);
      if (hangSave) return new Promise(() => {});
      if (failSave) throw new Error('save-failed');
      io.saved = data;
    },
    deleteStoryDoc: async (uid, id) => {
      io.calls.push(['deleteDoc', id]);
      if (hangDeleteDoc) return new Promise(() => {});
    }
  };
  return io;
}

describe('saveStoryWithMedia', () => {
  it('laedt neue Fotos hoch und speichert dann das Dokument', async () => {
    const io = fakeIo();
    const id = await saveStoryWithMedia('u1', draft({ photos: [{ blob: B }, { blob: B }], text: 'hi' }), { io });
    expect(io.calls.map(c => c[0])).toEqual(['upload', 'upload', 'save']);
    expect(io.saved.photos).toEqual([
      { path: `users/u1/stories/${id}/p0.jpg` }, { path: `users/u1/stories/${id}/p1.jpg` }
    ]);
    expect(io.saved.city).toBe('Wien');
    expect(io.saved.voice).toBeNull();
  });
  it('raeumt hochgeladene Dateien auf, wenn ein Upload scheitert, und speichert nichts', async () => {
    const io = fakeIo({ failUploadAt: 1 });
    await expect(saveStoryWithMedia('u1', draft({ photos: [{ blob: B }, { blob: B }] }), { io })).rejects.toThrow();
    expect(io.calls.map(c => c[0])).toEqual(['upload', 'upload', 'delete']);
    expect(io.saved).toBeUndefined();
  });
  it('raeumt auch auf, wenn das Speichern des Dokuments scheitert, und meldet den Fehler', async () => {
    const io = fakeIo({ failSave: true });
    const failed = new Promise(resolve => saveStoryWithMedia('u1', draft({ photos: [{ blob: B }] }), { io, onWriteError: resolve }));
    expect((await failed).message).toBe('save-failed');
    expect(io.calls.at(-1)[0]).toBe('delete');
  });
  it('wartet nach den Uploads nicht auf die Server-Bestaetigung', async () => {
    const io = fakeIo({ hangSave: true });
    const id = await saveStoryWithMedia('u1', draft({ photos: [{ blob: B }] }), { io });
    expect(id).toBe('new1');
    expect(io.calls.map(c => c[0])).toEqual(['upload', 'save']);
  });
  it('loescht beim Bearbeiten entfernte Dateien erst nach dem Speichern', async () => {
    const io = fakeIo();
    const existing = { id: 's1', city: 'Wien', photos: [{ path: 'a' }, { path: 'b' }], voice: null };
    await saveStoryWithMedia('u1', draft({ photos: [{ path: 'a' }] }), { existing, io });
    await flush();
    expect(io.calls).toEqual([['save', 's1'], ['delete', 'b']]);
  });
  it('vergibt beim Bearbeiten nie einen bestehenden Pfad neu', async () => {
    const io = fakeIo();
    const existing = { id: 's1', city: 'Wien', photos: [{ path: 'users/u1/stories/s1/p0.jpg' }, { path: 'users/u1/stories/s1/p1.jpg' }], voice: null };
    await saveStoryWithMedia('u1', draft({ photos: [{ path: 'users/u1/stories/s1/p1.jpg' }, { blob: B }] }), { existing, io });
    expect(io.saved.photos.at(-1)).toEqual({ path: 'users/u1/stories/s1/p2.jpg' });
  });
  it('ueberschreibt beim Bearbeiten nie die bestehende Sprachnotiz, auch nicht bei Fehlschlag', async () => {
    const io = fakeIo({ failSave: true });
    const old = 'users/u1/stories/s1/voice.m4a';
    const existing = { id: 's1', city: 'Wien', photos: [], voice: { path: old, seconds: 5 } };
    await new Promise(resolve => saveStoryWithMedia('u1', draft({ voice: { blob: B, seconds: 7 } }), { existing, io, onWriteError: resolve }));
    const uploads = io.calls.filter(c => c[0] === 'upload').map(c => c[1]);
    expect(uploads).toEqual(['users/u1/stories/s1/voice-1.m4a']);
    expect(io.calls.filter(c => c[0] === 'delete').map(c => c[1])).toEqual(['users/u1/stories/s1/voice-1.m4a']);
  });
  it('zeigt nach neuer Sprachnotiz auf den neuen Pfad und loescht die alte erst danach', async () => {
    const io = fakeIo();
    const existing = { id: 's1', city: 'Wien', photos: [], voice: { path: 'users/u1/stories/s1/voice.m4a', seconds: 5 } };
    await saveStoryWithMedia('u1', draft({ voice: { blob: B, seconds: 7 } }), { existing, io });
    await flush();
    expect(io.saved.voice).toEqual({ path: 'users/u1/stories/s1/voice-1.m4a', seconds: 7 });
    expect(io.calls.map(c => c[0])).toEqual(['upload', 'save', 'delete']);
    expect(io.calls.at(-1)[1]).toBe('users/u1/stories/s1/voice.m4a');
  });
  it('lehnt ungueltige Entwuerfe ab, bevor etwas hochgeladen wird', async () => {
    const io = fakeIo();
    await expect(saveStoryWithMedia('u1', draft(), { io })).rejects.toThrow('empty');
    expect(io.calls).toEqual([]);
  });
});

describe('deleteStoryWithMedia', () => {
  it('loescht Dateien vor dem Dokument', async () => {
    const io = fakeIo();
    await deleteStoryWithMedia('u1', { id: 's1', photos: [{ path: 'a' }], voice: { path: 'v' } }, { io });
    expect(io.calls).toEqual([['delete', 'a'], ['delete', 'v'], ['deleteDoc', 's1']]);
  });
  it('wartet offline bei Stories ohne Dateien nicht auf das Loeschen des Dokuments', async () => {
    const io = fakeIo({ hangDeleteDoc: true });
    await deleteStoryWithMedia('u1', { id: 's1', photos: [], voice: null }, { io, online: false });
    expect(io.calls).toEqual([['deleteDoc', 's1']]);
  });
});
