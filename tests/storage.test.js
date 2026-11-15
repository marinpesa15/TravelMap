import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __state, __reset } from './stubs/firebase-storage.js';
import { uploadBlob, blobUrl, deleteFile, publicUrl } from '../js/storage.js';

beforeEach(() => {
  __reset();
  vi.stubGlobal('URL', { createObjectURL: b => `blob:${b.name}` });
});

describe('storage wrapper', () => {
  it('uploads with the content type', async () => {
    const blob = { name: 'a' };
    await uploadBlob('stories/u/1.jpg', blob, 'image/jpeg');
    expect(__state.uploads).toEqual([['stories/u/1.jpg', blob, { contentType: 'image/jpeg' }]]);
  });

  it('blobUrl fetches once per path and caches the object URL', async () => {
    __state.blobs['p'] = { name: 'x' };
    expect(await blobUrl('p')).toBe('blob:x');
    expect(await blobUrl('p')).toBe('blob:x');
    expect(__state.getBlobCalls).toEqual(['p']);
  });

  it('blobUrl does not cache a failed load', async () => {
    await expect(blobUrl('q')).rejects.toThrow();
    __state.blobs['q'] = { name: 'y' };
    expect(await blobUrl('q')).toBe('blob:y');
  });

  it('deleteFile tolerates a missing object but rethrows other errors', async () => {
    __state.deleteError = { code: 'storage/object-not-found' };
    await expect(deleteFile('gone')).resolves.toBeUndefined();
    __state.deleteError = { code: 'storage/unauthorized' };
    await expect(deleteFile('nope')).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });

  it('deleteFile drops the cached URL', async () => {
    __state.blobs['d'] = { name: 'z' };
    await blobUrl('d');
    await deleteFile('d');
    await blobUrl('d');
    expect(__state.getBlobCalls).toEqual(['d', 'd']);
  });

  it('publicUrl uses getDownloadURL', async () => {
    __state.urls['avatar'] = 'https://x/avatar';
    expect(await publicUrl('avatar')).toBe('https://x/avatar');
  });
});
