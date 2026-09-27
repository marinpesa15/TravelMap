import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIRRORED } from '../scripts/build-landing.mjs';

// privacy.html and support.html have two jobs: the iOS app links them
// relatively out of its bundle (dist/), and Apple's forms point at
// travel.marinpesa.dev/privacy.html and /support.html, which Firebase serves
// from landing/. The repo root is the only source; scripts/build-landing.mjs
// copies into landing/. Two copies of a legal text drift silently, so this
// test goes red as soon as only one side gets edited.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('landing/ mirrors the root legal pages and their assets', () => {
  it('mirrors privacy.html and support.html', () => {
    expect(MIRRORED).toContain('privacy.html');
    expect(MIRRORED).toContain('support.html');
  });

  for (const rel of MIRRORED) {
    it(`landing/${rel} is byte-identical to ${rel} (run: npm run build:landing)`, () => {
      const source = fs.readFileSync(path.join(root, rel));
      const target = path.join(root, 'landing', rel);
      expect(fs.existsSync(target), `${target} missing`).toBe(true);
      expect(fs.readFileSync(target).equals(source), `landing/${rel} differs from ${rel}`).toBe(true);
    });
  }
});
