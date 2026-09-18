// Stub fuer js/config.js in den Emulator-Tests. Anders als config.js fuer
// `npm test` bekommt db.js hier eine echte Firestore-Instanz, die der Test
// per useDb() setzt. `db` ist ein Live-Binding, db.js sieht den neuen Wert.
export let db = null;
export const auth = { currentUser: null };
export function useDb(instance) { db = instance; }
