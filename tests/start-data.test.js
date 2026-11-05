// Der schnelle Start: erster Stand aus dem Cache, Profilabgleich ohne
// Warten auf die Server-Bestaetigung. Siehe loadUserDataFast und
// initUserProfile in js/db.js.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __state, __reset } from './stubs/firebase-firestore.js';
import { loadUserDataFast, initUserProfile } from '../js/db.js?v=27';

const DOC = { visited_cities: [{ name: 'Split' }], invite_token: 'tok', display_name: 'Ana', avatar_url: '' };

function completes(promise, ms = 80) {
  return Promise.race([
    promise.then(v => ({ done: true, value: v })),
    new Promise(resolve => setTimeout(() => resolve({ done: false }), ms))
  ]);
}

beforeEach(() => { __reset(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('loadUserDataFast', () => {
  it('nimmt den Cache-Stand sofort, ohne auf den Server zu warten', async () => {
    __state.snapshots = [{ exists: true, data: DOC, fromCache: true }];
    const result = await completes(loadUserDataFast('u1', { timeoutMs: 5000 }));
    expect(result.done).toBe(true);
    expect(result.value).toEqual({ data: DOC, fromCache: true });
  });

  it('wertet "existiert nicht" aus dem Cache nicht als neues Konto', async () => {
    __state.snapshots = [
      { exists: false, fromCache: true },
      { exists: true, data: DOC, fromCache: false }
    ];
    const result = await loadUserDataFast('u1', { timeoutMs: 5000 });
    expect(result).toEqual({ data: DOC, fromCache: false });
  });

  it('meldet ein neues Konto nur, wenn der Server es bestaetigt', async () => {
    __state.snapshots = [
      { exists: false, fromCache: true },
      { exists: false, fromCache: false }
    ];
    const result = await loadUserDataFast('u1', { timeoutMs: 5000 });
    expect(result).toEqual({ data: null, fromCache: false });
  });

  it('gibt nach dem Timeout null zurueck, wenn nichts kommt', async () => {
    __state.snapshots = [{ exists: false, fromCache: true }]; // Server schweigt
    const result = await loadUserDataFast('u1', { timeoutMs: 20 });
    expect(result).toBeNull();
  });

  it('gibt bei einem Listener-Fehler null zurueck statt zu haengen', async () => {
    __state.snapshots = [{ error: new Error('permission-denied') }];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await loadUserDataFast('u1', { timeoutMs: 5000 });
    expect(result).toBeNull();
    spy.mockRestore();
  });
});

describe('initUserProfile', () => {
  const user = { displayName: 'Ana Novak', photoURL: 'https://img.example/a.png' };

  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('crypto', { randomUUID: () => 'new-token' });
    __state.ackWrites = false; // Server bestaetigt nicht, z.B. schwaches Netz
  });

  it('wartet online nicht auf die Server-Bestaetigung', async () => {
    const result = await completes(initUserProfile('u1', user, DOC));
    expect(result.done).toBe(true);
    expect(result.value.display_name).toBe('Ana Novak');
    // Profil geaendert → ein Update, dazu der Invite-Eintrag
    expect(__state.writes.map(([kind]) => kind)).toEqual(['update', 'set']);
  });

  it('nutzt den mitgegebenen Stand statt erneut zu lesen', async () => {
    __state.doc = null; // getDoc wuerde "existiert nicht" liefern
    const data = await initUserProfile('u1', user, DOC);
    expect(data.visited_cities).toEqual([{ name: 'Split' }]);
    expect(data.invite_token).toBe('tok');
  });

  it('legt ein neues Konto an, wenn der Server keins kennt', async () => {
    const data = await initUserProfile('u1', user, null);
    expect(data.invite_token).toBe('new-token');
    expect(data.visited_cities).toEqual([]);
    expect(__state.writes[0][0]).toBe('set');
  });

  it('liest selbst, wenn kein Stand mitgegeben wurde', async () => {
    __state.doc = DOC;
    const data = await initUserProfile('u1', user);
    expect(data.invite_token).toBe('tok');
  });
});
