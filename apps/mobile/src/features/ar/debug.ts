/**
 * Field-test diagnostics for the AR guide. Dev builds only; read them with `adb logcat -s ReactNativeJS`.
 * Kept in one place so the console rule is suppressed once.
 */
export function arLog(...args: unknown[]): void {
  if (!__DEV__) return;
  // biome-ignore lint/suspicious/noConsole: AR field-test diagnostics, dev builds only
  console.log('[ar]', ...args);
}
