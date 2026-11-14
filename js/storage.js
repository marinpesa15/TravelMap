// Duenner Wrapper um Firebase Storage. Story-Medien laufen nie ueber
// getDownloadURL (das ergaebe eine dauerhaft teilbare URL), sondern ueber
// getBlob, damit die Storage-Rules bei jedem Abruf greifen.
import { storage } from './config.js?v=4';
import { ref, uploadBytes, getBlob, deleteObject, getDownloadURL } from '../vendor/firebase/10.12.0/firebase-storage.js';

const urls = new Map(); // pfad -> Promise<objectURL>

export async function uploadBlob(path, blob, contentType) {
  await uploadBytes(ref(storage, path), blob, { contentType });
  urls.delete(path);
}

export function blobUrl(path) {
  if (!urls.has(path)) {
    const p = getBlob(ref(storage, path)).then(b => URL.createObjectURL(b));
    p.catch(() => urls.delete(path)); // Fehlschlag nicht zwischenspeichern
    urls.set(path, p);
  }
  return urls.get(path);
}

export async function deleteFile(path) {
  urls.delete(path);
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}

// Nur fuer das Profilbild gedacht.
export function publicUrl(path) {
  return getDownloadURL(ref(storage, path));
}
