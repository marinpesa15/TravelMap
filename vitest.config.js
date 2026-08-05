import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Die App laedt Firebase als ESM vom CDN. Node kann https-Importe nicht
// aufloesen, deshalb zeigen CDN-URLs und die (gitignorte) config.js in Tests
// auf Stubs. Die Tests selbst arbeiten mit injizierten Fake-IO-Objekten.
const stub = name => fileURLToPath(new URL(`./tests/stubs/${name}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^https:\/\/www\.gstatic\.com\/firebasejs\/.+\/firebase-firestore\.js$/, replacement: stub('firebase-firestore.js') },
      { find: /^https:\/\/www\.gstatic\.com\/firebasejs\/.+\/firebase-auth\.js$/, replacement: stub('firebase-auth.js') },
      { find: /^\.\/config\.js(\?v=\d+)?$/, replacement: stub('config.js') }
    ]
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Rules-Tests brauchen den Firestore-Emulator und laufen separat
    // ueber `npm run test:rules`.
    exclude: ['tests/rules/**', '**/node_modules/**']
  }
});
