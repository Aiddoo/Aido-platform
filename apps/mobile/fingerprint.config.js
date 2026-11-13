// Expo fingerprint 설정. @expo/fingerprint는 fingerprint.config.js·.cjs만 읽어 .ts로 둘 수 없다.
// 기본 프리셋(balanced)에 package.json scripts 전체를 더 뺀다. scripts는 네이티브 런타임과 무관해서
// 바꿔도 OTA가 기존 스토어 빌드에 닿아야 한다.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: [
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'PackageJsonScriptsAll',
  ],
};

module.exports = config;
