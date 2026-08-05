import { defineConfig } from 'vitest/config';

// Security-Rules-Tests gegen den Firestore-Emulator. Nicht Teil von
// `npm test`, weil sie einen laufenden Emulator (und Java) brauchen:
// `npm run test:rules` startet ihn via emulators:exec selbst.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000
  }
});
