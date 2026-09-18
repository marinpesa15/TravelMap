import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Die App laedt Firebase als ESM aus vendor/firebase/. Tests sollen das echte
// SDK nicht hochfahren, deshalb zeigen die Vendor-Module und die (gitignorte)
// config.js in Tests auf Stubs. Die Tests selbst arbeiten mit injizierten Fake-IO-Objekten.
const stub = name => fileURLToPath(new URL(`./tests/stubs/${name}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^(\.\.?\/)*vendor\/firebase\/[^/]+\/firebase-firestore\.js$/, replacement: stub('firebase-firestore.js') },
      { find: /^(\.\.?\/)*vendor\/firebase\/[^/]+\/firebase-auth\.js$/, replacement: stub('firebase-auth.js') },
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
