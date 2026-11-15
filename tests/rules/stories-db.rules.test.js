// js/stories-db.js gegen den Emulator mit aktiven Rules.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useDb } from '../stubs/config-emulator.js';
import { saveStory, loadSharedStories } from '../../js/stories-db.js';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'travelmap-rules-test-stories-db',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), 'users', 'me', 'friends', 'anna'), { display_name: 'A', avatar_url: '' }));
});

const base = { city: 'Rom', country: 'IT', text: 'x', photos: [], shared: false };

describe('stories-db', () => {
  it('created_at bleibt beim zweiten Speichern, id wird nicht geschrieben', async () => {
    const db = env.authenticatedContext('me').firestore();
    useDb(db);
    await saveStory('me', 's1', { ...base, id: 's1', extra: undefined });
    const first = (await getDoc(doc(db, 'users', 'me', 'stories', 's1'))).data();
    expect(first.created_at).toBeTruthy();
    expect(first).not.toHaveProperty('id');
    await saveStory('me', 's1', { ...base, text: 'y', created_at: first.created_at });
    const second = (await getDoc(doc(db, 'users', 'me', 'stories', 's1'))).data();
    expect(second.text).toBe('y');
    expect(second.created_at.isEqual(first.created_at)).toBe(true);
  });

  it('loadSharedStories liefert nur geteilte, mit id', async () => {
    useDb(env.authenticatedContext('me').firestore());
    await saveStory('me', 'pub', { ...base, shared: true });
    await saveStory('me', 'priv', base);
    useDb(env.authenticatedContext('anna').firestore());
    const list = await loadSharedStories('me');
    expect(list.map(s => s.id)).toEqual(['pub']);
  });
});
