// Bild -> JPEG-Blob. createImageBitmap dekodiert auf iOS auch HEIC.
import { fitSize, squareCrop } from './image-logic.js?v=1';

/**
 * @param {File} file
 * @param {{ max: number, square?: boolean, quality?: number }} opts
 *   square: mittiger Ausschnitt, Kantenlaenge max (nie hochskaliert)
 * @returns {Promise<Blob>} wirft Error('not-an-image'), wenn nicht dekodierbar
 */
export async function toJpegBlob(file, { max, square = false, quality = 0.85 }) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('not-an-image');
  }
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (square) {
      const { sx, sy, size } = squareCrop(bitmap.width, bitmap.height);
      canvas.width = canvas.height = Math.min(size, max);
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    } else {
      const { w, h } = fitSize(bitmap.width, bitmap.height, max);
      canvas.width = w; canvas.height = h;
      ctx.drawImage(bitmap, 0, 0, w, h);
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('not-an-image');
    return blob;
  } finally {
    bitmap.close?.();
  }
}
