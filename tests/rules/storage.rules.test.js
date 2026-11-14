// Storage-Rules fuer das Profilbild, gegen den Storage-Emulator.
import { describe, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'travelmap-rules-test-storage',
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });

const storageOf = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();
const avatarOf = (s, uid = 'me') => ref(s, `users/${uid}/avatar.jpg`);
const jpeg = { contentType: 'image/jpeg' };
const bytes = n => new Uint8Array(n);

describe('storage: Profilbild users/{uid}/avatar.jpg', () => {
  it('Besitzer laedt ein 100 KB JPEG hoch', async () => {
    await assertSucceeds(uploadBytes(avatarOf(storageOf('me')), bytes(100 * 1024), jpeg));
  });
  it('fremder Nutzer darf nicht schreiben', async () => {
    await assertFails(uploadBytes(avatarOf(storageOf('mallory')), bytes(1024), jpeg));
  });
  it('image/png wird abgelehnt', async () => {
    await assertFails(uploadBytes(avatarOf(storageOf('me')), bytes(1024), { contentType: 'image/png' }));
  });
  it('2 MB werden abgelehnt', async () => {
    await assertFails(uploadBytes(avatarOf(storageOf('me')), bytes(2 * 1024 * 1024), jpeg));
  });
  it('Angemeldete lesen, nicht Angemeldete nicht', async () => {
    await assertSucceeds(uploadBytes(avatarOf(storageOf('me')), bytes(1024), jpeg));
    await assertSucceeds(getBytes(avatarOf(storageOf('anna'), 'me')));
    await assertFails(getBytes(avatarOf(storageOf(null), 'me')));
  });
});
