import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, decideUpdate } from '../js/update-logic.js';

describe('compareVersions', () => {
  it('compares numerically, not as strings', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.6.0', '1.6.0')).toBe(0);
    expect(compareVersions('1.6', '1.6.0')).toBe(0);
    expect(compareVersions('1.6.0', '1.6.1')).toBeLessThan(0);
    expect(compareVersions('v2.0.0', '1.99.99')).toBeGreaterThan(0);
  });
  it('treats junk parts as 0', () => {
    expect(parseVersion('1.x.3')).toEqual([1, 0, 3]);
  });
});

describe('decideUpdate', () => {
  const m = (latest, minimum, notes) => ({ latest, minimum, notes });

  it('shows nothing when up to date', () => {
    expect(decideUpdate('1.6.0', m('1.6.0', '1.6.0'))).toBeNull();
    expect(decideUpdate('1.7.0', m('1.6.0', '1.0.0'))).toBeNull();
  });

  it('offers a skippable update for a small release', () => {
    expect(decideUpdate('1.6.0', m('1.6.1', '1.6.0'))).toMatchObject({ kind: 'optional', latest: '1.6.1' });
    expect(decideUpdate('1.6.0', m('1.7.0', '1.0.0'))).toMatchObject({ kind: 'optional', latest: '1.7.0' });
  });

  it('forces the update below the minimum', () => {
    expect(decideUpdate('1.6.0', m('1.7.0', '1.7.0'))).toMatchObject({ kind: 'required', latest: '1.7.0' });
    expect(decideUpdate('1.5.0', m('1.7.0', '1.6.0'))).toMatchObject({ kind: 'required', latest: '1.7.0' });
  });

  it('forces the update for a new major version', () => {
    expect(decideUpdate('1.6.0', m('2.0.0', '1.0.0'))).toMatchObject({ kind: 'required', latest: '2.0.0' });
  });

  it('picks the notes in the UI language', () => {
    const notes = { de: 'Neu: Dark Mode', en: 'New: dark mode' };
    expect(decideUpdate('1.6.0', m('1.6.1', '1.6.0', notes), 'de').notes).toBe('Neu: Dark Mode');
    expect(decideUpdate('1.6.0', m('1.6.1', '1.6.0', notes), 'en').notes).toBe('New: dark mode');
    expect(decideUpdate('1.6.0', m('1.6.1', '1.6.0', { en: 'x' }), 'de').notes).toBe('x');
    expect(decideUpdate('1.6.0', m('1.6.1', '1.6.0'))).toMatchObject({ notes: '' });
  });

  it('ignores a broken manifest instead of nagging', () => {
    expect(decideUpdate('1.6.0', null)).toBeNull();
    expect(decideUpdate('1.6.0', 'oops')).toBeNull();
    expect(decideUpdate('1.6.0', { latest: 'soon' })).toBeNull();
    expect(decideUpdate('1.6.0', {})).toBeNull();
  });
});

describe('landing/app-version.json', async () => {
  const fs = await import('node:fs');
  const { APP_VERSION } = { APP_VERSION: fs.readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = '([^']+)'/)[1] };
  const manifest = JSON.parse(fs.readFileSync(new URL('../landing/app-version.json', import.meta.url), 'utf8'));

  it('never announces a minimum above latest', () => {
    expect(compareVersions(manifest.minimum, manifest.latest)).toBeLessThanOrEqual(0);
  });
  it('does not force the version in this repo to update itself', () => {
    expect(decideUpdate(APP_VERSION, manifest)?.kind).not.toBe('required');
  });
});
