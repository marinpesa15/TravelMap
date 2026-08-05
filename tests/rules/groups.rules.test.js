// Security-Rules-Tests fuer die Kontoloeschung, gegen den Firestore-Emulator.
// Getestet wird vor allem die Angriffsrichtung: Niemand ausser dem austretenden
// Ersteller darf created_by veraendern, und list auf /invites bleibt auf die
// eigenen Docs beschraenkt.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where
} from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'travelmap-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const asUser = uid => env.authenticatedContext(uid).firestore();

const baseGroup = {
  name: 'Reisegruppe',
  created_by: 'me',
  members: ['me', 'anna'],
  visited_cities: [],
  wishlist_cities: []
};

const seedGroup = (data = {}) => env.withSecurityRulesDisabled(ctx =>
  setDoc(doc(ctx.firestore(), 'groups', 'g1'), { ...baseGroup, ...data })
);

describe('groups: Uebergabe von created_by', () => {
  it('erlaubt dem austretenden Ersteller die Uebergabe an ein Mitglied', async () => {
    await seedGroup();
    await assertSucceeds(updateDoc(doc(asUser('me'), 'groups', 'g1'), {
      created_by: 'anna', members: ['anna']
    }));
  });

  it('verbietet einem Nicht-Ersteller, created_by zu kapern', async () => {
    await seedGroup();
    await assertFails(updateDoc(doc(asUser('anna'), 'groups', 'g1'), {
      created_by: 'anna'
    }));
  });

  it('verbietet einem austretenden Nicht-Ersteller die Uebernahme', async () => {
    await seedGroup({ members: ['me', 'anna', 'ben'] });
    await assertFails(updateDoc(doc(asUser('anna'), 'groups', 'g1'), {
      created_by: 'ben', members: ['me', 'ben']
    }));
  });

  it('verbietet die Uebergabe, wenn der Ersteller Mitglied bleibt', async () => {
    await seedGroup();
    await assertFails(updateDoc(doc(asUser('me'), 'groups', 'g1'), {
      created_by: 'anna'
    }));
  });

  it('verbietet die Uebergabe an jemanden, der kein Mitglied ist', async () => {
    await seedGroup();
    await assertFails(updateDoc(doc(asUser('me'), 'groups', 'g1'), {
      created_by: 'zoe', members: ['anna']
    }));
  });

  it('erlaubt normale Updates mit unveraendertem created_by weiterhin', async () => {
    await seedGroup();
    await assertSucceeds(updateDoc(doc(asUser('anna'), 'groups', 'g1'), {
      members: ['me', 'anna', 'ben']
    }));
  });
});

describe('groups: Loeschen', () => {
  it('erlaubt dem Ersteller das Loeschen', async () => {
    await seedGroup();
    await assertSucceeds(deleteDoc(doc(asUser('me'), 'groups', 'g1')));
  });

  it('erlaubt dem letzten Mitglied das Loeschen, auch als Nicht-Ersteller', async () => {
    await seedGroup({ created_by: 'geloeschtes-konto', members: ['anna'] });
    await assertSucceeds(deleteDoc(doc(asUser('anna'), 'groups', 'g1')));
  });

  it('verbietet einem Nicht-Ersteller das Loeschen, solange andere drin sind', async () => {
    await seedGroup();
    await assertFails(deleteDoc(doc(asUser('anna'), 'groups', 'g1')));
  });
});

describe('invites: list nur fuer eigene Docs', () => {
  // ctx.firestore() vertraegt nur einen Aufruf pro Kontext, danach wirft es
  // "settings can no longer be changed". Deshalb einmal holen und teilen.
  const seedInvites = () => env.withSecurityRulesDisabled(async ctx => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'invites', 'tok-me'),
      { uid: 'me', display_name: 'M', avatar_url: '' });
    await setDoc(doc(fs, 'invites', 'tok-anna'),
      { uid: 'anna', display_name: 'A', avatar_url: '' });
  });

  it('erlaubt die Query nach der eigenen uid', async () => {
    await seedInvites();
    await assertSucceeds(getDocs(
      query(collection(asUser('me'), 'invites'), where('uid', '==', 'me'))
    ));
  });

  it('verbietet die Query nach einer fremden uid', async () => {
    await seedInvites();
    await assertFails(getDocs(
      query(collection(asUser('me'), 'invites'), where('uid', '==', 'anna'))
    ));
  });

  it('verbietet die ungefilterte Enumeration aller Invites', async () => {
    await seedInvites();
    await assertFails(getDocs(collection(asUser('me'), 'invites')));
  });
});
