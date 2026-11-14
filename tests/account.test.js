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
    findInviteTokens: rec('findInviteTokens', ['tok']),
    deleteInvite: rec('deleteInvite'),
    stories: [],
    loadStories: () => { calls.push('loadStories'); return Promise.resolve(io.stories); },
    deleteFile: path => { calls.push('deleteFile:' + path); return Promise.resolve(); },
    deleteStoryDoc: (uid, id) => { calls.push('deleteStoryDoc:' + id); return Promise.resolve(); },
    deleteAvatar: rec('deleteAvatar'),
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
    expect(io.calls.indexOf('deleteInvite')).toBeLessThan(io.calls.indexOf('deleteUserDoc'));
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

  it('ueberspringt das Invite-Doc, wenn keines existiert', async () => {
    const io = fakeIo({ findInviteTokens: () => Promise.resolve([]) });
    await deleteAccount('me', { io });
    expect(io.calls).not.toContain('deleteInvite');
  });

  it('loescht das Invite-Doc auch, wenn das User-Doc schon weg ist', async () => {
    // Wiederholungsfall: Ein frueherer Versuch starb zwischen deleteUserDoc
    // und deleteAuthUser. Das Token steht nirgends mehr, die Query nach der
    // eigenen uid findet das Invite-Doc trotzdem.
    const io = fakeIo({
      loadUser: () => Promise.resolve(null),
      findInviteTokens: () => { io.calls.push('findInviteTokens'); return Promise.resolve(['verwaist']); }
    });
    await deleteAccount('me', { io });
    expect(io.calls).toContain('deleteInvite');
    expect(io.calls.at(-1)).toBe('deleteAuthUser');
  });

  it('meldet jeden Schritt an onProgress', async () => {
    const io = fakeIo();
    const seen = [];
    await deleteAccount('me', { io, onProgress: s => seen.push(s) });
    expect(seen).toEqual(['groups', 'friends', 'invite', 'stories', 'profileDoc', 'account']);
  });

  const twoStories = () => [
    { id: 's1', city: 'Rom', photos: [{ path: 'users/me/stories/s1/p0.jpg' }, { path: 'users/me/stories/s1/p1.jpg' }],
      voice: { path: 'users/me/stories/s1/voice-2.m4a' } },
    // verwaiste Story: Stadt existiert nicht mehr, wird trotzdem geloescht
    { id: 's2', city: 'Weg', photos: [{ path: 'users/me/stories/s2/p0.jpg' }] }
  ];

  it('loescht je Story erst alle Dateien, dann das Dokument, dann das Profilbild, alles vor dem User-Doc', async () => {
    const io = fakeIo();
    io.stories = twoStories();
    await deleteAccount('me', { io });
    const c = io.calls;
    expect(c.slice(c.indexOf('loadStories'), c.indexOf('deleteUserDoc'))).toEqual([
      'loadStories',
      'deleteFile:users/me/stories/s1/p0.jpg',
      'deleteFile:users/me/stories/s1/p1.jpg',
      'deleteFile:users/me/stories/s1/voice-2.m4a',
      'deleteStoryDoc:s1',
      'deleteFile:users/me/stories/s2/p0.jpg',
      'deleteStoryDoc:s2',
      'deleteAvatar'
    ]);
    expect(c.at(-1)).toBe('deleteAuthUser');
  });

  it('loescht das Profilbild auch ohne Stories', async () => {
    const io = fakeIo();
    await deleteAccount('me', { io });
    expect(io.calls).toContain('deleteAvatar');
  });

  it('bricht vor dem User-Doc ab, wenn eine Datei nicht geloescht werden kann, und ein zweiter Lauf geht durch', async () => {
    const io = fakeIo();
    io.stories = twoStories();
    let fail = true;
    const deleted = new Set();
    io.deleteFile = path => {
      io.calls.push('deleteFile:' + path);
      if (fail && path.endsWith('p1.jpg')) return Promise.reject(new Error('network'));
      deleted.add(path);
      return Promise.resolve();
    };
    io.deleteStoryDoc = (uid, id) => {
      io.calls.push('deleteStoryDoc:' + id);
      io.stories = io.stories.filter(s => s.id !== id);
      return Promise.resolve();
    };
    await expect(deleteAccount('me', { io })).rejects.toThrow('network');
    expect(io.calls).not.toContain('deleteStoryDoc:s1');
    expect(io.calls).not.toContain('deleteUserDoc');
    expect(io.calls).not.toContain('deleteAuthUser');
    expect(io.stories).toHaveLength(2);

    fail = false;
    io.calls.length = 0;
    await deleteAccount('me', { io });
    expect(io.stories).toHaveLength(0);
    expect(io.calls.at(-1)).toBe('deleteAuthUser');
  });
});

describe('collectDeletionSummary', () => {
  it('zaehlt Staedte, Laender, Freunde, Gruppen und Stories', async () => {
    const io = fakeIo({
      loadUser: () => Promise.resolve({
        visited_cities: [{ name: 'Rom' }, { name: 'Wien' }],
        wishlist_cities: [{ name: 'Oslo' }],
        visited_countries: ['IT', 'AT'],
        wishlist_countries: ['NO']
      }),
      loadFriendUids: () => Promise.resolve(['anna', 'ben']),
      loadMyGroups: () => Promise.resolve([{ id: 'g1' }]),
      loadStories: () => Promise.resolve([{ id: 's1' }, { id: 's2' }, { id: 's3' }])
    });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 3, countries: 3, friends: 2, groups: 1, stories: 3 });
  });

  it('liefert Nullen fuer ein leeres Konto', async () => {
    const io = fakeIo({ loadUser: () => Promise.resolve(null) });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 0, countries: 0, friends: 0, groups: 0, stories: 0 });
  });
});
