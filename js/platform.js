// Single switch for "are we running inside the native iOS shell?".
// Hard-wired to false until the Capacitor build and its native sign-in
// plugin exist; then this becomes Capacitor.isNativePlatform().
export function isNative() {
  return false;
}
