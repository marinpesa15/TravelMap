// Storage-Rules fuer Profilbild und Story-Medien (letztere lesen per Cross-Service
// firestore.exists/get die Freundschaft und das shared-Flag), gegen den Storage-Emulator.
import { describe, it, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Muss die --project-ID von emulators:exec sein: der Storage-Emulator fragt
    // Firestore fuer firestore.exists/get unter dieser ID ab.
    projectId: 'travelmap-f4e3a',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
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

describe('storage: Story-Medien users/{uid}/stories/{storyId}/{file}', () => {
  const audio = { contentType: 'audio/mp4' };
  const file = (s, uid = 'me', id = 's1', name = 'p1.jpg') => ref(s, `users/${uid}/stories/${id}/${name}`);
  const seed = async shared => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'me', 'friends', 'anna'), { display_name: 'Anna', avatar_url: '' });
      await setDoc(doc(db, 'users', 'me', 'stories', 's1'), { city: 'Lissabon', shared });
      await uploadBytes(file(ctx.storage()), bytes(1024), jpeg);
    });
  };

  it('Besitzer schreibt JPEG und Audio, liest immer', async () => {
    await seed(false);
    await assertSucceeds(uploadBytes(file(storageOf('me'), 'me', 's1', 'p2.jpg'), bytes(1024), jpeg));
    await assertSucceeds(uploadBytes(file(storageOf('me'), 'me', 's1', 'voice.m4a'), bytes(1024), audio));
    await assertSucceeds(getBytes(file(storageOf('me'))));
  });
  it('Freund liest Datei einer geteilten Story', async () => {
    await seed(true);
    await assertSucceeds(getBytes(file(storageOf('anna'))));
  });
  it('Freund liest dieselbe Datei nach shared = false nicht mehr', async () => {
    await seed(true);
    await assertSucceeds(getBytes(file(storageOf('anna'))));
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', 'me', 'stories', 's1'), { city: 'Lissabon', shared: false });
    });
    await assertFails(getBytes(file(storageOf('anna'))));
  });
  it('Fremder ohne Freundeseintrag liest eine geteilte Story nicht', async () => {
    await seed(true);
    await assertFails(getBytes(file(storageOf('mallory'))));
    await assertFails(getBytes(file(storageOf(null))));
  });
  it('Freund schreibt nicht', async () => {
    await seed(true);
    await assertFails(uploadBytes(file(storageOf('anna'), 'me', 's1', 'x.jpg'), bytes(1024), jpeg));
  });
  it('Besitzer: audio/webm wird abgelehnt', async () => {
    await assertFails(uploadBytes(file(storageOf('me'), 'me', 's1', 'v.webm'), bytes(1024), { contentType: 'audio/webm' }));
  });
  it('Besitzer: 4 MB Audio wird abgelehnt, 2 MB gehen', async () => {
    await assertSucceeds(uploadBytes(file(storageOf('me'), 'me', 's1', 'ok.m4a'), bytes(2 * 1024 * 1024), audio));
    await assertFails(uploadBytes(file(storageOf('me'), 'me', 's1', 'big.m4a'), bytes(4 * 1024 * 1024), audio));
  });
  it('Besitzer: 2 MB JPEG wird abgelehnt', async () => {
    await assertFails(uploadBytes(file(storageOf('me'), 'me', 's1', 'big.jpg'), bytes(2 * 1024 * 1024), jpeg));
  });
});
