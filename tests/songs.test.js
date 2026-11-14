import { describe, it, expect } from 'vitest';
import { safeCover } from '../js/songs.js';

describe('safeCover', () => {
  it('nimmt nur Cover von Spotifys Bildserver', () => {
    expect(safeCover('https://i.scdn.co/image/ab67616d0000b273')).toBe('https://i.scdn.co/image/ab67616d0000b273');
    expect(safeCover('https://evil.example/i.scdn.co/x.jpg')).toBe('');
    expect(safeCover('https://i.scdn.co.evil.example/x.jpg')).toBe('');
    expect(safeCover('http://i.scdn.co/image/x')).toBe('');
  });
  it('verwirft alles, was kein String ist', () => {
    expect(safeCover(undefined)).toBe('');
    expect(safeCover({})).toBe('');
  });
});
