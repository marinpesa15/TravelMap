// Die gebuendelte Basiskarte data/basemap.pmtiles muss lesbar sein und die
// Schichten haben, die der Protomaps-Style erwartet (js/map.js).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PMTiles } from 'pmtiles';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/basemap.pmtiles');

function fileSource(p) {
  const fd = fs.openSync(p, 'r');
  return {
    getKey: () => p,
    getBytes: async (offset, length) => {
      const b = Buffer.alloc(length);
      fs.readSync(fd, b, 0, length, offset);
      return { data: b.buffer.slice(b.byteOffset, b.byteOffset + length) };
    }
  };
}

describe('data/basemap.pmtiles', () => {
  it('liegt im Repo und ist eine PMTiles-v3-Datei mit Vektorkacheln', async () => {
    expect(fs.existsSync(file)).toBe(true);
    const header = await new PMTiles(fileSource(file)).getHeader();
    expect(header.tileType).toBe(1);        // MVT
    expect(header.tileCompression).toBe(2); // gzip
    expect(header.minZoom).toBe(0);
    expect(header.maxZoom).toBeGreaterThanOrEqual(7);
    expect(header.numTileEntries).toBeGreaterThan(1000);
  });

  it('hat die Schichten des Protomaps-Schemas', async () => {
    const meta = await new PMTiles(fileSource(file)).getMetadata();
    const ids = meta.vector_layers.map(l => l.id);
    for (const id of ['earth', 'water', 'boundaries', 'places']) expect(ids).toContain(id);
  });

  it('liefert die Weltkachel', async () => {
    const tile = await new PMTiles(fileSource(file)).getZxy(0, 0, 0);
    expect(tile?.data.byteLength).toBeGreaterThan(1000);
  });
});
