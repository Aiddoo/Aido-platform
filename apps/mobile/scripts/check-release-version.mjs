import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appStoreVersionSchema } from '@aido/validators';

const appDirectory = fileURLToPath(new URL('..', import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const manifest = readJson('package.json');
const eas = readJson('eas.json');
const result = spawnSync('pnpm', ['exec', 'expo', 'config', '--type', 'public', '--json'], {
  cwd: appDirectory,
  env: { ...process.env, APP_ENV: 'production' },
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error || result.status !== 0) {
  console.error(
    'Expo production config 확인에 실패했습니다. 설정과 환경변수 값은 출력하지 않습니다.',
  );
  process.exit(1);
}

let config;
try {
  config = JSON.parse(result.stdout);
} catch {
  console.error('Expo config 응답이 올바른 JSON이 아닙니다. 응답 내용은 출력하지 않습니다.');
  process.exit(1);
}
const checks = [
  ['출시 버전 형식', appStoreVersionSchema.safeParse(manifest.version).success],
  ['package/Expo 출시 버전 일치', config.version === manifest.version],
  ['EAS 원격 빌드 번호', eas.cli.appVersionSource === 'remote'],
  ['production 빌드 번호 자동 증가', eas.build.production.autoIncrement === true],
  ['OTA 네이티브 호환 fingerprint', config.runtimeVersion?.policy === 'fingerprint'],
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`출시 버전 ${manifest.version}: 검증 완료. 스토어 공개 버전 설정은 별도로 관리합니다.`);
