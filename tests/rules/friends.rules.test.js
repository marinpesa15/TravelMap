// Friends-Eintrag ist die Grundlage fuer Story-Zugriff: Sich selbst in die
// Liste eines anderen einzutragen geht nur mit dem Invite-Token dieses Nutzers.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, getBytes, uploadBytes } from 'firebase/storage';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Muss die --project-ID von emulators:exec sein (Storage -> Firestore Lookup)
    projectId: 'travelmap-f4e3a',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });
});
afterAll(async () => { await env.cleanup(); });

const dbs = {};
const fs = uid => (dbs[uid] ??= env.authenticatedContext(uid).firestore());
const entry = (extra = {}) => ({ display_name: 'M', avatar_url: '', since: new Date(), ...extra });
const friendDoc = (db, owner, friend) => doc(db, 'users', owner, 'friends', friend);

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'alice'), { display_name: 'Alice' });
    await setDoc(doc(db, 'invites', 'tok-alice'), { uid: 'alice', display_name: 'Alice', avatar_url: '' });
    await setDoc(doc(db, 'invites', 'tok-bob'), { uid: 'bob', display_name: 'Bob', avatar_url: '' });
    await setDoc(doc(db, 'users', 'alice', 'stories', 's1'), { city: 'Rom', shared: true });
    await uploadBytes(ref(ctx.storage(), 'users/alice/stories/s1/p.jpg'), new Uint8Array(10), { contentType: 'image/jpeg' });
  });
});

describe('friends: Selbst-Eintrag in fremde Liste', () => {
  const selfInsert = extra => setDoc(friendDoc(fs('mallory'), 'alice', 'mallory'), entry(extra));

  it('ohne Token wird abgelehnt', async () => { await assertFails(selfInsert()); });
  it('mit unbekanntem Token wird abgelehnt', async () => { await assertFails(selfInsert({ token: 'nope' })); });
  it('mit Invite-Token eines anderen Nutzers wird abgelehnt', async () => { await assertFails(selfInsert({ token: 'tok-bob' })); });
  it('mit dem echten Invite-Token von alice geht', async () => { await assertSucceeds(selfInsert({ token: 'tok-alice' })); });

  it('nach abgelehntem Eintrag kein Zugriff auf Profil, Story, Medien', async () => {
    await assertFails(selfInsert());
    await assertFails(getDoc(doc(fs('mallory'), 'users', 'alice')));
    await assertFails(getDoc(doc(fs('mallory'), 'users', 'alice', 'stories', 's1')));
    await assertFails(getBytes(ref(env.authenticatedContext('mallory').storage(), 'users/alice/stories/s1/p.jpg')));
  });
  it('mit gueltigem Token dagegen Zugriff auf Profil und Story', async () => {
    await assertSucceeds(selfInsert({ token: 'tok-alice' }));
    await assertSucceeds(getDoc(doc(fs('mallory'), 'users', 'alice')));
    await assertSucceeds(getDoc(doc(fs('mallory'), 'users', 'alice', 'stories', 's1')));
  });
});

describe('friends: Besitzer und Update', () => {
  it('alice traegt bob in die eigene Liste ein, ohne Token', async () => {
    await assertSucceeds(setDoc(friendDoc(fs('alice'), 'alice', 'bob'), entry()));
  });
  it('Legacy-Eintrag ohne Token: Freund darf avatar_url aendern', async () => {
    await env.withSecurityRulesDisabled(ctx => setDoc(friendDoc(ctx.firestore(), 'alice', 'bob'), entry()));
    await assertSucceeds(updateDoc(friendDoc(fs('bob'), 'alice', 'bob'), { avatar_url: 'x' }));
  });
  it('Freund darf token nicht aendern, auch nicht hinzufuegen', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(friendDoc(db, 'alice', 'bob'), entry({ token: 'tok-alice' }));
      await setDoc(friendDoc(db, 'alice', 'carl'), entry());
    });
    await assertFails(updateDoc(friendDoc(fs('bob'), 'alice', 'bob'), { token: 'tok-bob' }));
    await assertFails(updateDoc(friendDoc(fs('carl'), 'alice', 'carl'), { token: 'tok-alice' }));
    await assertSucceeds(updateDoc(friendDoc(fs('bob'), 'alice', 'bob'), { avatar_url: 'y' }));
  });
});
