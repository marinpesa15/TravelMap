// Security-Rules-Tests fuer users/{uid}/stories, gegen den Firestore-Emulator.
// Stories sind privat; ein Freund liest nur, wenn shared == true.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where
} from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'travelmap-rules-test-stories',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });

const asUser = uid => env.authenticatedContext(uid).firestore();
const story = (uid, id) => db => doc(db, 'users', uid, 'stories', id);
const col = (db, uid = 'me') => collection(db, 'users', uid, 'stories');

const base = { city: 'Lissabon', country: 'PT', text: 'Schoen', photos: [], shared: false };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    // anna ist Freundin von me (Freundeseintrag unter dem Besitzer)
    await setDoc(doc(db, 'users', 'me', 'friends', 'anna'), { display_name: 'Anna', avatar_url: '' });
    await setDoc(doc(db, 'users', 'me', 'stories', 'priv'), { ...base, shared: false });
    await setDoc(doc(db, 'users', 'me', 'stories', 'pub'), { ...base, shared: true });
  });
});

describe('stories: Besitzer', () => {
  it('legt an, liest, aendert und loescht', async () => {
    const db = asUser('me');
    await assertSucceeds(setDoc(story('me', 'new')(db), base));
    await assertSucceeds(getDoc(story('me', 'new')(db)));
    await assertSucceeds(updateDoc(story('me', 'new')(db), { text: 'neu' }));
    await assertSucceeds(deleteDoc(story('me', 'new')(db)));
  });
  it('darf alle eigenen Stories ohne Filter listen', async () => {
    await assertSucceeds(getDocs(col(asUser('me'))));
  });
});

describe('stories: Freund lesen', () => {
  it('get einer geteilten Story geht', async () => {
    await assertSucceeds(getDoc(story('me', 'pub')(asUser('anna'))));
  });
  it('get einer privaten Story wird abgelehnt', async () => {
    await assertFails(getDoc(story('me', 'priv')(asUser('anna'))));
  });
  it('Query mit shared == true geht', async () => {
    await assertSucceeds(getDocs(query(col(asUser('anna')), where('shared', '==', true))));
  });
  it('Query ohne Filter wird abgelehnt', async () => {
    await assertFails(getDocs(col(asUser('anna'))));
  });
});

describe('stories: Fremder ohne Freundeseintrag', () => {
  it('get einer geteilten Story wird abgelehnt', async () => {
    await assertFails(getDoc(story('me', 'pub')(asUser('mallory'))));
  });
  it('Query mit shared == true wird abgelehnt', async () => {
    await assertFails(getDocs(query(col(asUser('mallory')), where('shared', '==', true))));
  });
  it('nicht angemeldet wird abgelehnt', async () => {
    await assertFails(getDoc(story('me', 'pub')(env.unauthenticatedContext().firestore())));
  });
});

describe('stories: Freund schreibt nicht', () => {
  it('create wird abgelehnt', async () => {
    await assertFails(setDoc(story('me', 'x')(asUser('anna')), base));
  });
  it('update wird abgelehnt', async () => {
    await assertFails(updateDoc(story('me', 'pub')(asUser('anna')), { text: 'hack' }));
  });
  it('delete wird abgelehnt', async () => {
    await assertFails(deleteDoc(story('me', 'pub')(asUser('anna'))));
  });
});

describe('stories: Validierung (Besitzer)', () => {
  const put = data => setDoc(story('me', 'v')(asUser('me')), data);
  it('Positiv: 10 Fotos, 2000 Zeichen, alle erlaubten Felder', async () => {
    await assertSucceeds(put({
      ...base, text: 'a'.repeat(2000), photos: Array(10).fill('p.jpg'),
      date: '2026-01-01', voice: 'v.m4a', song: { id: 's' }, created_at: new Date()
    }));
  });
  it('song: null und vollstaendige Map sind gueltig', async () => {
    await assertSucceeds(put({ ...base, song: null }));
    await assertSucceeds(put({ ...base, song: { id: 's', title: 'T', artist: 'A', cover_url: 'https://i.scdn.co/x' } }));
  });
  it('song mit unbekanntem Schluessel oder zu langer cover_url wird abgelehnt', async () => {
    await assertFails(put({ ...base, song: { id: 's', extra: 'x' } }));
    await assertFails(put({ ...base, song: { id: 's', cover_url: 'h'.repeat(501) } }));
    await assertFails(put({ ...base, song: 'text' }));
  });
  it('11 Fotos werden abgelehnt', async () => {
    await assertFails(put({ ...base, photos: Array(11).fill('p.jpg') }));
  });
  it('Text mit 2001 Zeichen wird abgelehnt', async () => {
    await assertFails(put({ ...base, text: 'a'.repeat(2001) }));
  });
  it('unbekanntes Feld wird abgelehnt', async () => {
    await assertFails(put({ ...base, extra: 1 }));
  });
  it('shared als String wird abgelehnt', async () => {
    await assertFails(put({ ...base, shared: 'true' }));
  });
  it('leerer Stadtname wird abgelehnt', async () => {
    await assertFails(put({ ...base, city: '' }));
  });
});
