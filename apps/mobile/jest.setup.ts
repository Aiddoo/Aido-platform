// Expo 57 installs `fetch` as an enumerable lazy getter. Jest 29 enumerates globals
// after disposing the test environment, which can evaluate that getter too late and
// fail while loading ExpoModulesCoreJSLogger. Restore the original Node fetch eagerly
// for tests; individual HTTP tests can still replace it with their own mock.
const originalFetch =
  Object.getOwnPropertyDescriptor(globalThis, 'originalfetch')?.value ??
  Object.getOwnPropertyDescriptor(globalThis, 'originalFetch')?.value;

if (typeof originalFetch === 'function') {
  globalThis.fetch = originalFetch as typeof fetch;
}
