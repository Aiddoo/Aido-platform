import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name) => process.argv[process.argv.indexOf(name) + 1];
const device = process.argv.includes('--device') ? argument('--device') : undefined;
const legacyApk = process.argv.includes('--legacy-apk') ? argument('--legacy-apk') : undefined;
assert(
  device && legacyApk,
  'Supply --device and --legacy-apk using a dedicated AidoWidgetUpgrade AVD.',
);
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'aido-widget-upgrade-'));
const sdk = process.env.ANDROID_HOME ?? path.join(os.homedir(), 'Library/Android/sdk');
const tools = path.join(sdk, 'build-tools/37.0.0');
const androidJar = path.join(sdk, 'platforms/android-37.0/android.jar');
const run = (command, args) =>
  execFileSync(command, args, { cwd: output, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const adb = (...args) => run(path.join(sdk, 'platform-tools/adb'), ['-s', device, ...args]);
assert.match(
  adb('emu', 'avd', 'name'),
  /^AidoWidgetUpgrade/m,
  'This audit clears only an isolated AidoWidgetUpgrade AVD.',
);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const currentApk = path.join(mobileRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
assert(fs.existsSync(currentApk), 'Build the current debug APK first.');
assert(fs.existsSync(legacyApk), 'Legacy APK missing.');
const currentVersion = run(path.join(tools, 'aapt'), ['dump', 'badging', currentApk]).match(
  /versionName='([^']+)'/,
)?.[1];
const legacyVersion = run(path.join(tools, 'aapt'), [
  'dump',
  'badging',
  path.resolve(legacyApk),
]).match(/versionName='([^']+)'/)?.[1];

const ts = require('typescript');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const {
  buildWidgetSnapshot,
} = require('../src/features/widget/__tests__/widget-snapshot.factory.ts');
const { toWidgetProps } = require('../src/features/widget/services/widget-props.mapper.ts');
const date = adb('shell', 'date', '+%F').trim();
const snapshot = buildWidgetSnapshot({ date });
delete snapshot.strings.compactStreakLabel;
snapshot.topTodos.push({ id: 2, title: '색상 안전성', completed: false, categoryColor: 'invalid' });
const expected = toWidgetProps(snapshot, 'data');
const loggedOut = toWidgetProps(
  buildWidgetSnapshot({
    state: 'loggedOut',
    date,
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    currentStreak: 0,
    topTodos: [],
  }),
  'loggedOut',
);
fs.writeFileSync(path.join(output, 'snapshot.json'), JSON.stringify(snapshot));
fs.writeFileSync(path.join(output, 'expected.json'), JSON.stringify(expected));

fs.mkdirSync(path.join(output, 'classes'));
fs.mkdirSync(path.join(output, 'dex'));
const source = path.join(
  mobileRoot,
  'scripts/android-widget-upgrade/WidgetUpgradeInstrumentation.java',
);
run('javac', [
  '-source',
  '8',
  '-target',
  '8',
  '-classpath',
  androidJar,
  '-d',
  path.join(output, 'classes'),
  source,
]);
run(path.join(tools, 'd8'), [
  '--lib',
  androidJar,
  '--output',
  path.join(output, 'dex'),
  path.join(output, 'classes/dev/aido/widgetqa/WidgetUpgradeInstrumentation.class'),
]);
const manifest =
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="dev.aido.widgetqa"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><application android:label="Aido native widget QA"/><instrumentation android:name="dev.aido.widgetqa.WidgetUpgradeInstrumentation" android:targetPackage="com.aido.mobile"/></manifest>';
fs.writeFileSync(path.join(output, 'AndroidManifest.xml'), manifest);
run(path.join(tools, 'aapt'), [
  'package',
  '-f',
  '-M',
  path.join(output, 'AndroidManifest.xml'),
  '-I',
  androidJar,
  '-F',
  path.join(output, 'unsigned.apk'),
]);
run('zip', ['-j', path.join(output, 'unsigned.apk'), path.join(output, 'dex/classes.dex')]);
run(path.join(tools, 'apksigner'), [
  'sign',
  '--ks',
  path.join(mobileRoot, 'android/app/debug.keystore'),
  '--ks-pass',
  'pass:android',
  '--key-pass',
  'pass:android',
  '--out',
  path.join(output, 'widget-qa.apk'),
  path.join(output, 'unsigned.apk'),
]);

const instrument = (mode, input = {}) => {
  const args = [
    'am instrument -w -e mode',
    quote(mode),
    ...Object.entries(input).flatMap(([key, value]) => [
      '-e',
      quote(key),
      quote(JSON.stringify(value)),
    ]),
    'dev.aido.widgetqa/dev.aido.widgetqa.WidgetUpgradeInstrumentation',
  ];
  const log = adb('shell', args.join(' '));
  fs.writeFileSync(path.join(output, `${mode}.log`), log);
  assert(log.includes('INSTRUMENTATION_CODE: -1'), log);
  return JSON.parse(
    log
      .split('\n')
      .find((line) => line.startsWith('INSTRUMENTATION_RESULT: report='))
      .split('report=')[1],
  );
};
adb('shell', 'pm', 'clear', 'com.aido.mobile');
adb('install', '-r', '-d', path.resolve(legacyApk));
adb('install', '-r', path.join(output, 'widget-qa.apk'));
adb('shell', 'appwidget', 'grantbind', '--package', 'com.aido.mobile', '--user', '0');
const originalIds = instrument('seed', { snapshot });
const hashesBefore = adb(
  'shell',
  'run-as com.aido.mobile sha256sum files/mmkv/widget-storage files/mmkv/widget-storage.crc',
);
adb('install', '-r', currentApk);
const migrated = instrument('verify');
const rows = { AidoTodaySummary: 0, AidoTodayList: 3, AidoTodayLarge: 8 };
for (const [name, maxRows] of Object.entries(rows)) {
  assert.equal(migrated[name].id, originalIds[name]);
  assert.equal(migrated[name].provider, `com.aido.mobile/com.aido.mobile.widget.${name}`);
  assert.deepEqual(migrated[name].props, { ...expected, maxRows });
}
assert.equal(
  adb(
    'shell',
    'run-as com.aido.mobile sha256sum files/mmkv/widget-storage files/mmkv/widget-storage.crc',
  ),
  hashesBefore,
);
const corrupted = instrument('corrupt');
for (const name of Object.keys(rows)) {
  assert.equal(corrupted[name].props.state, 'stale');
  assert.deepEqual(corrupted[name].props.topTodos, []);
}
const malformed = instrument('corrupt', { snapshot: { ...snapshot, totalTodos: '5' } });
for (const name of Object.keys(rows)) assert.equal(malformed[name].props.state, 'stale');
const preserved = instrument('preserve', { props: loggedOut });
for (const name of Object.keys(rows)) assert.equal(preserved[name].props.marker, 'new-account');
const raced = instrument('race', { snapshot, props: loggedOut });
assert.equal(raced.raceIterations, 50);
const reloaded = instrument('reload', {
  props: {
    ...expected,
    completedTodos: 4,
    totalTodos: 6,
    topTodos: [{ ...expected.topTodos[0], title: 'SDK reload fixture' }],
  },
});
for (const name of Object.keys(rows)) assert.equal(reloaded[name].id, originalIds[name]);
const summary = {
  legacyVersion,
  currentVersion,
  widgetsPreserved: 3,
  coldMapperMatches: true,
  legacyMmkvUnchanged: true,
  corruptFallback: true,
  malformedFallback: true,
  accountWriteRaces: 50,
  sdkRefreshes: 3,
  output,
};
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
