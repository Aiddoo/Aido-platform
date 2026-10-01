import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

// Check strong two-level imports against the named bundled Expo framework's exported symbols.
// This catches the ExpoFileSystem -> ExpoModulesJSI DYLD failure before a TestFlight upload.
const ipa = process.argv[2];
if (!ipa || !existsSync(ipa))
  throw new Error('Usage: node scripts/check-ipa-expo-linkage.mjs <IPA>');
if (process.platform !== 'darwin')
  throw new Error('IPA linkage validation requires macOS Xcode tools.');

const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const directory = mkdtempSync(join(tmpdir(), 'aido-ipa-linkage-'));
run('/usr/bin/unzip', ['-q', resolve(ipa), '-d', directory]);
const payload = join(directory, 'Payload');
const apps = readdirSync(payload).filter((name) => name.endsWith('.app'));
if (apps.length !== 1) throw new Error('Expected exactly one main application in IPA.');
const app = join(payload, apps[0]);
const executable = run('/usr/bin/plutil', [
  '-extract',
  'CFBundleExecutable',
  'raw',
  join(app, 'Info.plist'),
]).trim();
const frameworks = join(app, 'Frameworks');
const providers = new Map(
  readdirSync(frameworks)
    .filter((name) => name.startsWith('Expo') && name.endsWith('.framework'))
    .map((name) => [
      name.replace('.framework', ''),
      join(frameworks, name, name.replace('.framework', '')),
    ]),
);
const exports = new Map(
  [...providers].map(([name, binary]) => [
    name,
    new Set(run('xcrun', ['nm', '-gUj', '-arch', 'arm64', binary]).trim().split('\n')),
  ]),
);
const failures = [];
let checked = 0;
for (const binary of [join(app, executable), ...providers.values()]) {
  for (const line of run('xcrun', ['nm', '-m', '-arch', 'arm64', binary]).split('\n')) {
    const reference = line.match(/\(undefined\) external (\S+) \(from (Expo\w+)\)/);
    if (!reference) continue;
    const [, symbol, provider] = reference;
    checked++;
    if (!exports.get(provider)?.has(symbol))
      failures.push({ consumer: basename(binary), provider, symbol });
  }
}
console.log(
  JSON.stringify(
    { ipa: resolve(ipa), extracted: app, expoFrameworks: providers.size, checked, failures },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
