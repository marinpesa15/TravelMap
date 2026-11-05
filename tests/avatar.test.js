// Initialen und Farbe fuer den Avatar-Platzhalter, siehe js/avatar.js.
import { describe, it, expect } from 'vitest';
import { initials, avatarColor } from '../js/avatar.js?v=1';

describe('initials', () => {
  it('nimmt Vor- und Nachnamen', () => {
    expect(initials('Christian Göhner')).toBe('CG');
    expect(initials('Iljazovic Kata')).toBe('IK');
  });

  it('nimmt bei einem Wort nur den ersten Buchstaben', () => {
    expect(initials('Martina')).toBe('M');
    expect(initials('  marcel ')).toBe('M');
  });

  it('nimmt bei drei Woertern das erste und das letzte', () => {
    expect(initials('Anna Maria Schmidt')).toBe('AS');
  });

  it('ueberspringt Emojis und Zeichen am Wortanfang', () => {
    expect(initials('❤️ Lubav')).toBe('L');
    expect(initials('(Max) Mustermann')).toBe('MM');
  });

  it('liefert ? ohne Namen', () => {
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
    expect(initials('   ')).toBe('?');
    expect(initials('🙂')).toBe('?');
  });

  it('behaelt Umlaute', () => {
    expect(initials('Ömer Ülker')).toBe('ÖÜ');
  });
});

describe('avatarColor', () => {
  it('ist fuer denselben Seed stabil', () => {
    expect(avatarColor('uid-123')).toBe(avatarColor('uid-123'));
  });

  it('liefert immer eine Hex-Farbe', () => {
    for (const seed of ['a', 'b', 'c', 'uid-1', 'uid-2', '', null]) {
      expect(avatarColor(seed)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('verteilt verschiedene Seeds auf mehrere Farben', () => {
    const colors = new Set(Array.from({ length: 40 }, (_, i) => avatarColor(`user-${i}`)));
    expect(colors.size).toBeGreaterThan(3);
  });
});
