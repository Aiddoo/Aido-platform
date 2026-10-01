const fs = require('node:fs/promises');
const { IOSConfig, withDangerousMod } = require('expo/config-plugins');

/**
 * RNFirebase 26.4's plugin does not recognize Expo SDK 58's scene-based AppDelegate.
 * Configure the default native Firebase app before constructing the React Native factory.
 * Fail prebuild if the template changes instead of silently shipping without Firebase.
 */
function configureFirebaseAppDelegate(contents) {
  const launch =
    /public override func application\(\s*_ application: UIApplication,\s*didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\s*\) -> Bool \{\r?\n/;
  const match = launch.exec(contents);
  if (!match) {
    throw new Error('[withFirebaseInitialization] Unsupported Swift AppDelegate launch method.');
  }

  const insertion = match.index + match[0].length;
  const calls = contents.match(/FirebaseApp\.configure\s*\(/g) ?? [];
  if (calls.length > 0) {
    if (calls.length !== 1 || !/^\s*FirebaseApp\.configure\(\)/.test(contents.slice(insertion))) {
      throw new Error(
        '[withFirebaseInitialization] Firebase must be configured once at launch entry.',
      );
    }
  } else {
    const newline = contents.includes('\r\n') ? '\r\n' : '\n';
    contents = `${contents.slice(0, insertion)}    FirebaseApp.configure()${newline}${newline}${contents.slice(insertion)}`;
  }

  if (!/^import FirebaseCore\s*$/m.test(contents)) {
    const newline = contents.includes('\r\n') ? '\r\n' : '\n';
    contents = `import FirebaseCore${newline}${contents}`;
  }
  return contents;
}

const withFirebaseInitialization = (config) =>
  // Register after RNFirebase: dangerous mods run in reverse registration order.
  // Its plugin then sees the existing initialization and does not skip with a warning.
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const delegate = IOSConfig.Paths.getAppDelegate(config.modRequest.projectRoot);
      if (delegate.language !== 'swift') {
        throw new Error('[withFirebaseInitialization] Expected Expo SDK 58 Swift AppDelegate.');
      }
      await fs.writeFile(delegate.path, configureFirebaseAppDelegate(delegate.contents));
      return config;
    },
  ]);

module.exports = withFirebaseInitialization;
module.exports.configureFirebaseAppDelegate = configureFirebaseAppDelegate;
