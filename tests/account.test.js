import { describe, it, expect } from 'vitest';
import { deleteAccount, collectDeletionSummary } from '../js/account.js';

function fakeIo(over = {}) {
  const calls = [];
  const rec = (name, ret) => (...args) => { calls.push(name); return Promise.resolve(ret); };
  const io = {
    calls,
    // Fake-Datenbestand: loadMyGroups liefert ihn, applyGroupChange liest
    // daraus wie die echte Transaktion frisch aus Firestore.
    groups: [],
    reauthenticate: rec('reauthenticate'),
    loadUser: rec('loadUser', { invite_token: 'tok', visited_cities: [], wishlist_cities: [],
                                visited_countries: [], wishlist_countries: [] }),
    loadMyGroups: (...args) => { calls.push('loadMyGroups'); return Promise.resolve(io.groups); },
    applyGroupChange: (groupId, decide) => {
      calls.push('applyGroupChange');
      const g = io.groups.find(x => x.id === groupId);
      const plan = g ? decide(g) : null;
      if (plan?.action === 'delete') calls.push('deleteGroup');
      else if (plan) calls.push('updateGroup');
      return Promise.resolve();
    },
    loadFriendUids: rec('loadFriendUids', []),
    deleteFriendPairs: rec('deleteFriendPairs'),
    deleteInvite: rec('deleteInvite'),
    deleteUserDoc: rec('deleteUserDoc'),
    deleteAuthUser: rec('deleteAuthUser'),
    ...over
  };
  return io;
}

describe('deleteAccount', () => {
  it('loescht den Auth-Account als allerletztes', async () => {
    const io = fakeIo();
    await deleteAccount('me', { io });
    expect(io.calls[0]).toBe('reauthenticate');
    expect(io.calls.at(-1)).toBe('deleteAuthUser');
    expect(io.calls.indexOf('deleteUserDoc')).toBeLessThan(io.calls.indexOf('deleteAuthUser'));
    expect(io.calls.indexOf('deleteFriendPairs')).toBeLessThan(io.calls.indexOf('deleteUserDoc'));
  });

  it('bricht ohne jede Datenaenderung ab, wenn die Neuanmeldung fehlschlaegt', async () => {
    const io = fakeIo({ reauthenticate: () => Promise.reject(new Error('popup-closed')) });
    await expect(deleteAccount('me', { io })).rejects.toThrow('popup-closed');
    expect(io.calls).toEqual([]);
    expect(io.calls).not.toContain('deleteAuthUser');
  });

  it('laesst den Auth-Account stehen, wenn eine Gruppe fehlschlaegt', async () => {
    const io = fakeIo({
      applyGroupChange: () => Promise.reject(new Error('permission-denied'))
    });
    io.groups = [{ id: 'g1', created_by: 'me', members: ['me', 'anna'] }];
    await expect(deleteAccount('me', { io })).rejects.toThrow('permission-denied');
    expect(io.calls).not.toContain('deleteAuthUser');
    expect(io.calls).not.toContain('deleteUserDoc');
  });

  it('loescht eine Gruppe, in der ich das letzte Mitglied bin', async () => {
    const io = fakeIo();
    io.groups = [{ id: 'g1', created_by: 'me', members: ['me'] }];
    await deleteAccount('me', { io });
    expect(io.calls).toContain('deleteGroup');
    expect(io.calls).not.toContain('updateGroup');
  });

  it('fasst eine Gruppe nicht an, aus der ich zwischenzeitlich raus bin', async () => {
    // loadMyGroups sah mich noch als Mitglied, die Transaktion liest den
    // frischen Stand ohne mich. Ein Update wuerde von den Rules abgelehnt.
    const io = fakeIo({
      loadMyGroups: (...a) => { io.calls.push('loadMyGroups'); return Promise.resolve([
        { id: 'g1', created_by: 'anna', members: ['me', 'anna'] }
      ]); }
    });
    io.groups = [{ id: 'g1', created_by: 'anna', members: ['anna'] }];
    await deleteAccount('me', { io });
    expect(io.calls).toContain('applyGroupChange');
    expect(io.calls).not.toContain('updateGroup');
    expect(io.calls).not.toContain('deleteGroup');
    expect(io.calls).toContain('deleteAuthUser');
  });

  it('fasst eine Gruppe nicht an, die zwischenzeitlich geloescht wurde', async () => {
    const io = fakeIo({
      loadMyGroups: (...a) => { io.calls.push('loadMyGroups'); return Promise.resolve([
        { id: 'weg', created_by: 'me', members: ['me'] }
      ]); }
    });
    io.groups = [];
    await deleteAccount('me', { io });
    expect(io.calls).not.toContain('updateGroup');
    expect(io.calls).not.toContain('deleteGroup');
    expect(io.calls).toContain('deleteAuthUser');
  });

  it('ueberspringt das Invite-Doc, wenn kein Token vorhanden ist', async () => {
    const io = fakeIo({ loadUser: () => Promise.resolve({}) });
    await deleteAccount('me', { io });
    expect(io.calls).not.toContain('deleteInvite');
  });

  it('meldet jeden Schritt an onProgress', async () => {
    const io = fakeIo();
    const seen = [];
    await deleteAccount('me', { io, onProgress: s => seen.push(s) });
    expect(seen).toContain('groups');
    expect(seen).toContain('account');
  });
});

describe('collectDeletionSummary', () => {
  it('zaehlt Staedte, Laender, Freunde und Gruppen', async () => {
    const io = fakeIo({
      loadUser: () => Promise.resolve({
        visited_cities: [{ name: 'Rom' }, { name: 'Wien' }],
        wishlist_cities: [{ name: 'Oslo' }],
        visited_countries: ['IT', 'AT'],
        wishlist_countries: ['NO']
      }),
      loadFriendUids: () => Promise.resolve(['anna', 'ben']),
      loadMyGroups: () => Promise.resolve([{ id: 'g1' }])
    });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 3, countries: 3, friends: 2, groups: 1 });
  });

  it('liefert Nullen fuer ein leeres Konto', async () => {
    const io = fakeIo({ loadUser: () => Promise.resolve(null) });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 0, countries: 0, friends: 0, groups: 0 });
  });
});
