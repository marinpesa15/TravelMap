// Single switch for "are we running inside the native iOS shell?".
// There is no bundler, so @capacitor/core can't be imported here; the native
// shell injects window.Capacitor itself. In a plain browser it is absent and
// this stays false.
export function isNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
