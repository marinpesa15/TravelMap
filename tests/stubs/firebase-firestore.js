// Stub fuer das Firebase-CDN-Modul. Node kann keine https-Importe laden,
// deshalb biegt vitest.config.js die CDN-URLs hierher um. Die Tests injizieren
// ohnehin ein Fake-IO, diese Funktionen werden nie aufgerufen.
export const doc = () => ({});
export const collection = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const getDocs = async () => ({ docs: [] });
export const deleteDoc = async () => {};
export const updateDoc = async () => {};
export const writeBatch = () => ({ delete: () => {}, commit: async () => {} });
export const query = () => ({});
export const where = () => ({});
export const runTransaction = async () => {};
