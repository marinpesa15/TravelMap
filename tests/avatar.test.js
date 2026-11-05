// Initialen und Farbe fuer den Avatar-Platzhalter, siehe js/avatar.js.
import { describe, it, expect } from 'vitest';
import { initials, avatarColor, safeAvatarUrl } from '../js/avatar.js?v=2';

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

describe('safeAvatarUrl', () => {
  it('laesst http(s) und Bild-Daten-URLs durch', () => {
    expect(safeAvatarUrl('https://lh3.googleusercontent.com/a.png')).toBe('https://lh3.googleusercontent.com/a.png');
    expect(safeAvatarUrl('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
    // Gruppenfotos aus dem Foto-Dialog liegen als JPEG-Daten-URL in Firestore
    expect(safeAvatarUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(safeAvatarUrl('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
  });

  it('blockt alles andere', () => {
    expect(safeAvatarUrl('javascript:alert(1)')).toBe('');
    expect(safeAvatarUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(safeAvatarUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(safeAvatarUrl('file:///etc/passwd')).toBe('');
    expect(safeAvatarUrl('')).toBe('');
    expect(safeAvatarUrl(null)).toBe('');
  });
});
