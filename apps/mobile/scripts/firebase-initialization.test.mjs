import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { configureFirebaseAppDelegate } = require('../plugins/withFirebaseInitialization.js');

// SDK 58 starts React Native in SceneDelegate, so RNFirebase's old factory.startReactNative anchor is absent.
const delegate = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

test('SDK 58 configures Firebase before creating React Native, exactly once across repeated prebuilds', () => {
  const result = configureFirebaseAppDelegate(delegate);
  assert.ok(result.includes('import FirebaseCore'));
  assert.ok(result.indexOf('FirebaseApp.configure()') < result.indexOf('let delegate'));
  assert.equal((result.match(/FirebaseApp.configure\(\)/g) ?? []).length, 1);
  assert.equal(configureFirebaseAppDelegate(result), result);
});

test('preserves CRLF and an existing Firebase import', () => {
  const input = delegate
    .replace('import React\n', 'import FirebaseCore\nimport React\n')
    .replaceAll('\n', '\r\n');
  const result = configureFirebaseAppDelegate(input);
  assert.equal((result.match(/import FirebaseCore/g) ?? []).length, 1);
  assert.ok(!/(?<!\r)\n/.test(result));
});

test('unsupported templates stop prebuild instead of skipping Firebase initialization', () => {
  assert.throws(() => configureFirebaseAppDelegate('class AppDelegate {}'), /Unsupported/);
});

test('late or duplicate initialization stops prebuild', () => {
  const late = delegate.replace(
    '    return super',
    '    FirebaseApp.configure()\n    return super',
  );
  assert.throws(() => configureFirebaseAppDelegate(late), /once at launch entry/);
  const configured = configureFirebaseAppDelegate(delegate);
  assert.throws(
    () =>
      configureFirebaseAppDelegate(
        configured.replace('    let factory', '    FirebaseApp.configure()\n    let factory'),
      ),
    /once at launch entry/,
  );
});
