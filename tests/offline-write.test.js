import { describe, it, expect } from 'vitest';
import { isOfflineError, settleWrite } from '../js/offline-write.js';

describe('isOfflineError', () => {
  it('erkennt den Code fuer "Server nicht erreichbar"', () => {
    expect(isOfflineError({ code: 'unavailable' })).toBe(true);
    expect(isOfflineError({ code: 'firestore/unavailable' })).toBe(true);
    expect(isOfflineError({ code: 'deadline-exceeded' })).toBe(true);
  });

  it('laesst echte Fehler durch', () => {
    expect(isOfflineError({ code: 'permission-denied' })).toBe(false);
    expect(isOfflineError(new Error('boom'))).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
  });
});

describe('settleWrite', () => {
  it('wartet online auf die Bestaetigung', async () => {
    let settled = false;
    const write = new Promise(resolve => setTimeout(() => { settled = true; resolve('ok'); }, 5));
    await settleWrite(write, { online: true });
    expect(settled).toBe(true);
  });

  it('wartet offline nicht, der Schreibvorgang laeuft aber weiter', async () => {
    let settled = false;
    // Wie Firestore offline: das Versprechen wird erst mit Netz erfuellt.
    const write = new Promise(resolve => setTimeout(() => { settled = true; resolve('ok'); }, 50));
    await settleWrite(write, { online: false });
    expect(settled).toBe(false);
  });

  it('meldet einen spaeter scheiternden Schreibvorgang statt ihn zu verschlucken', async () => {
    const seen = [];
    const write = Promise.reject(new Error('rules'));
    await settleWrite(write, { online: false, onError: err => seen.push(err.message) });
    await new Promise(r => setTimeout(r, 0));
    expect(seen).toEqual(['rules']);
  });
});
