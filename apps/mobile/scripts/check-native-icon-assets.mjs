import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_ICON_KEYS } from '@aido/validators';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'expo', 'config', '--type', 'public', '--json'], {
    cwd: root,
    env: { ...process.env, APP_ENV: 'development' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const iconPlugin = config.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-quick-actions/icon/plugin',
);
assert.ok(iconPlugin, '네이티브 아이콘 플러그인이 필요합니다.');
assert.equal(config.version, packageJson.version, '네이티브 버전은 package.json과 같아야 합니다.');
assert.equal(
  config.ios.infoPlist.UIViewControllerBasedStatusBarAppearance,
  true,
  'Expo Router의 화면별 상태 표시줄을 iOS ViewController가 관리해야 합니다.',
);
assert.equal(
  config.runtimeVersion.policy,
  'fingerprint',
  '네이티브 변경은 새 런타임으로 배포해야 합니다.',
);
assert.deepEqual(
  Object.keys(iconPlugin[1]),
  PROFILE_ICON_KEYS.filter((key) => key !== 'default'),
  '공유 키의 순서와 네이티브 등록이 일치해야 합니다.',
);

for (const key of ['russian_blue', 'cream_cat', 'tuxedo_cat']) {
  const metadata = await sharp(resolve(root, iconPlugin[1][key].image)).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.hasAlpha, false, `${key} 앱 아이콘은 불투명해야 합니다.`);
  assert.equal(metadata.space, 'srgb');
}

for (const name of ['todo', 'memo', 'mypage']) {
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    const metadata = await sharp(resolve(root, `assets/tab-icons/${name}${suffix}.png`)).metadata();
    assert.equal(metadata.width, 24 * scale);
    assert.equal(metadata.height, 24 * scale);
    assert.equal(metadata.hasAlpha, true, `${name} 탭 아이콘은 투명 배경이어야 합니다.`);
  }
}
console.log(
  `앱 아이콘 ${PROFILE_ICON_KEYS.length}종과 탭 이미지 9개의 네이티브 에셋 검증을 통과했습니다.`,
);
