import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { addKakaoCompileSdk } = require('../plugins/withKakaoAndroidCompileSdk.js');

const rootBuildGradle = `apply plugin: "expo-root-project"
apply plugin: "com.facebook.react.rootproject"
`;

test('Kakao 라이브러리 모듈만 앱 compileSdk로 맞추고 prebuild를 반복해도 한 번만 추가한다', () => {
  const result = addKakaoCompileSdk(rootBuildGradle);
  assert.ok(result.startsWith(rootBuildGradle.trimEnd()));
  assert.match(result, /subproject\.name ==~ \/\^@\?react-native-kakao_\.\+\//);
  assert.match(
    result,
    /finalizeDsl \{ android ->\s+android\.compileSdk = rootProject\.ext\.compileSdkVersion/,
  );
  assert.equal(addKakaoCompileSdk(result), result);
});
