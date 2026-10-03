import { describe, it, expect, vi } from 'vitest';
import { inviteTokenFromUrl, launchInviteToken, watchAppLinks } from '../js/app-links.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe('inviteTokenFromUrl', () => {
  it('liest den Token aus dem Universal Link', () => {
    expect(inviteTokenFromUrl('https://travel.marinpesa.dev/map.html?token=abc123')).toBe('abc123');
  });
  it('kommt auch mit eigenen URL-Schemas und Muell klar', () => {
    expect(inviteTokenFromUrl('com.example.app://map.html?token=xyz')).toBe('xyz');
    expect(inviteTokenFromUrl('https://travel.marinpesa.dev/')).toBeNull();
    expect(inviteTokenFromUrl('not a url')).toBeNull();
    expect(inviteTokenFromUrl(undefined)).toBeNull();
  });
});

describe('launchInviteToken', () => {
  it('tut im Browser nichts', async () => {
    const getLaunchUrl = vi.fn();
    expect(await launchInviteToken({ native: false, getLaunchUrl, storage: memStorage() })).toBeNull();
    expect(getLaunchUrl).not.toHaveBeenCalled();
  });

  it('liefert den Token der Start-URL genau einmal pro Sitzung', async () => {
    const storage = memStorage();
    const getLaunchUrl = vi.fn().mockResolvedValue({ url: 'https://travel.marinpesa.dev/map.html?token=t1' });
    expect(await launchInviteToken({ native: true, getLaunchUrl, storage })).toBe('t1');
    // Reload derselben Sitzung: die Start-URL ist dieselbe, der Token ist verbraucht
    expect(await launchInviteToken({ native: true, getLaunchUrl, storage })).toBeNull();
  });

  it('schluckt fehlende Start-URL und Plugin-Fehler', async () => {
    expect(await launchInviteToken({ native: true, getLaunchUrl: async () => undefined, storage: memStorage() })).toBeNull();
    expect(await launchInviteToken({ native: true, getLaunchUrl: async () => { throw new Error('no plugin'); }, storage: memStorage() })).toBeNull();
  });
});

describe('watchAppLinks', () => {
  it('registriert nativ den appUrlOpen-Listener und meldet neue Tokens', () => {
    const storage = memStorage();
    let handler;
    const addListener = vi.fn((plugin, event, cb) => { handler = cb; });
    const onToken = vi.fn();
    watchAppLinks(onToken, { native: true, addListener, storage });
    expect(addListener).toHaveBeenCalledWith('App', 'appUrlOpen', expect.any(Function));

    handler({ url: 'https://travel.marinpesa.dev/map.html?token=t2' });
    handler({ url: 'https://travel.marinpesa.dev/map.html?token=t2' }); // Wiederholung
    handler({ url: 'https://travel.marinpesa.dev/support.html' });     // kein Token
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('t2');
  });

  it('ignoriert eine URL, die launchInviteToken schon verbraucht hat', async () => {
    const storage = memStorage();
    const url = 'https://travel.marinpesa.dev/map.html?token=t3';
    await launchInviteToken({ native: true, getLaunchUrl: async () => ({ url }), storage });
    let handler;
    const onToken = vi.fn();
    watchAppLinks(onToken, { native: true, addListener: (p, e, cb) => { handler = cb; }, storage });
    handler({ url });
    expect(onToken).not.toHaveBeenCalled();
  });

  it('tut im Browser nichts', () => {
    const addListener = vi.fn();
    watchAppLinks(() => {}, { native: false, addListener, storage: memStorage() });
    expect(addListener).not.toHaveBeenCalled();
  });
});
