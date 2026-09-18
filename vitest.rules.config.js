import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Security-Rules-Tests gegen den Firestore-Emulator. Nicht Teil von
// `npm test`, weil sie einen laufenden Emulator (und Java) brauchen:
// `npm run test:rules` startet ihn via emulators:exec selbst.
//
// Damit auch js/db.js selbst gegen den Emulator laufen kann, zeigt das
// Firestore-Vendor-Modul hier auf das npm-Paket (statt auf einen leeren Stub)
// und config.js auf einen Stub, dem der Test die Emulator-Instanz reicht.
const stub = name => fileURLToPath(new URL(`./tests/stubs/${name}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^(\.\.?\/)*vendor\/firebase\/[^/]+\/firebase-firestore\.js$/, replacement: 'firebase/firestore' },
      { find: /^\.\/config\.js(\?v=\d+)?$/, replacement: stub('config-emulator.js') }
    ]
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000
  }
});
