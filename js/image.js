// Bild -> JPEG-Blob. createImageBitmap dekodiert auf iOS auch HEIC.
import { fitSize, squareCrop, nextQuality, MAX_JPEG_BYTES } from './image-logic.js?v=2';

/**
 * @param {File} file
 * @param {{ max: number, square?: boolean, quality?: number }} opts
 *   square: mittiger Ausschnitt, Kantenlaenge max (nie hochskaliert)
 * @returns {Promise<Blob>} wirft Error('not-an-image'), wenn nicht dekodierbar,
 *   Error('too-large'), wenn der JPEG auch bei niedrigster Qualitaet ueber 1 MB bleibt
 */
export async function toJpegBlob(file, { max, square = false, quality = 0.85 }) {
  let bitmap;
  try {
    // Ohne die Option drehen aeltere WebKit-Versionen Hochformatfotos nicht nach EXIF
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
    const encode = q => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
    let blob = await encode(quality);
    while (blob && blob.size > MAX_JPEG_BYTES) {
      quality = nextQuality(quality);
      if (quality == null) throw new Error('too-large');
      blob = await encode(quality);
    }
    if (!blob) throw new Error('not-an-image');
    return blob;
  } finally {
    bitmap.close?.();
  }
}
