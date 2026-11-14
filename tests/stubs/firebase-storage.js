// Stub fuer das Firebase-Storage-Vendor-Modul (siehe firebase-firestore.js).
// storage.test.js steuert ueber `__state`, was die SDK-Funktionen liefern.
export const __state = {
  blobs: {},       // pfad -> Blob, den getBlob liefert
  getBlobCalls: [],
  uploads: [],     // [pfad, blob, metadata]
  deleted: [],
  deleteError: null,
  urls: {}         // pfad -> getDownloadURL
};

export function __reset() {
  __state.blobs = {};
  __state.getBlobCalls = [];
  __state.uploads = [];
  __state.deleted = [];
  __state.deleteError = null;
  __state.urls = {};
}

export const ref = (storage, path) => ({ fullPath: path });
export const uploadBytes = async (r, blob, metadata) => { __state.uploads.push([r.fullPath, blob, metadata]); };
export const getBlob = async r => { __state.getBlobCalls.push(r.fullPath); return __state.blobs[r.fullPath]; };
export const deleteObject = async r => {
  if (__state.deleteError) throw __state.deleteError;
  __state.deleted.push(r.fullPath);
};
export const getDownloadURL = async r => __state.urls[r.fullPath];
