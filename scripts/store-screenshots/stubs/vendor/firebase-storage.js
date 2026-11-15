// Demo-Ersatz fuer Firebase Storage: Fotos kommen aus public/demo/ (eigener Origin), kein Upload.
import { mediaFile } from '../../../demo/demo-data.js';

export const getStorage = () => ({});
export const ref = (storage, path) => ({ fullPath: path });
export async function getBlob(r) {
  const file = mediaFile(r.fullPath);
  // Sprachnotiz: leere Aufnahme reicht, abgespielt wird fuer die Screenshots nichts
  if (!file) return new Blob([], { type: 'audio/mp4' });
  const res = await fetch(new URL(`../../../demo/${file}`, import.meta.url));
  if (!res.ok) throw Object.assign(new Error('demo media missing'), { code: 'storage/object-not-found' });
  return res.blob();
}
export const uploadBytes = async () => ({});
export const deleteObject = async () => {};
export const getDownloadURL = async () => '';
