import { describe, it, expect, beforeEach } from 'vitest';
import { auth } from './stubs/config.js';
import { changeAvatar, removeAvatar } from '../js/profile.js?v=1';

const BASE = 'https://firebasestorage.example/o/avatar.jpg?alt=media&token=abc';

function fakeIo({ base = BASE, failAt = null } = {}) {
  const calls = [];
  const step = (name, ret) => async (...args) => {
    calls.push([name, ...args.filter(a => typeof a === 'string' || Array.isArray(a))]);
    if (failAt === name) throw new Error(`fail-${name}`);
    return ret;
  };
  return {
    calls,
    toJpegBlob: step('toJpegBlob', new Blob(['x'])),
    uploadBlob: step('uploadBlob'),
    publicUrl: async () => base,
    deleteFile: step('deleteFile'),
    loadUser: async () => ({ invite_token: 'tok' }),
    loadFriendUids: async () => ['f1', 'f2'],
    setAuthPhoto: step('setAuthPhoto'),
    setUserAvatar: step('setUserAvatar'),
    setInviteAvatar: step('setInviteAvatar'),
    setFriendAvatars: step('setFriendAvatars')
  };
}

beforeEach(() => { auth.currentUser = { uid: 'me' }; });

describe('changeAvatar', () => {
  it('schreibt in der Reihenfolge Auth, User-Doc, Invite, Freunde', async () => {
    const io = fakeIo();
    const url = await changeAvatar({}, { io });
    expect(io.calls.map(c => c[0])).toEqual([
      'toJpegBlob', 'uploadBlob', 'setAuthPhoto', 'setUserAvatar', 'setInviteAvatar', 'setFriendAvatars'
    ]);
    expect(url).toMatch(new RegExp(`^${BASE.replace(/[?.]/g, '\\$&')}&v=\\d+$`));
    expect(io.calls.find(c => c[0] === 'uploadBlob')[1]).toBe('users/me/avatar.jpg');
    expect(io.calls.find(c => c[0] === 'setFriendAvatars')[2]).toEqual(['f1', 'f2']);
  });

  it('bricht ohne Schreibzugriff ab, wenn die URL laenger als 500 Zeichen ist', async () => {
    const io = fakeIo({ base: BASE + 'x'.repeat(500) });
    await expect(changeAvatar({}, { io })).rejects.toThrow('avatar-url-too-long');
    expect(io.calls.map(c => c[0])).not.toContain('setAuthPhoto');
  });

  it('laesst die spaeteren Schritte aus, wenn Auth scheitert', async () => {
    const io = fakeIo({ failAt: 'setAuthPhoto' });
    await expect(changeAvatar({}, { io })).rejects.toThrow('fail-setAuthPhoto');
    expect(io.calls.map(c => c[0])).not.toContain('setUserAvatar');
  });
});

describe('removeAvatar', () => {
  it('leert alles und loescht die Datei zuletzt', async () => {
    const io = fakeIo();
    await removeAvatar({ io });
    expect(io.calls.map(c => c[0])).toEqual([
      'setAuthPhoto', 'setUserAvatar', 'setInviteAvatar', 'setFriendAvatars', 'deleteFile'
    ]);
    expect(io.calls.find(c => c[0] === 'setUserAvatar')).toEqual(['setUserAvatar', 'me', '']);
  });
});
