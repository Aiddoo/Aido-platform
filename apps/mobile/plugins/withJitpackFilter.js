const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * JitPack 타임아웃으로 인한 Android 빌드 실패를 방지합니다.
 *
 * 1. JitPack repository에 content filter를 추가하여 com.github.* 그룹만 조회
 * 2. bouncycastle 버전을 강제 고정하여 버전 범위 해소(metadata 조회)를 방지
 */
const withJitpackFilter = (config) => {
  return withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // 1) JitPack content filter
    buildGradle = buildGradle.replace(
      /maven\s*\{\s*url\s*['"]https:\/\/www\.jitpack\.io['"]\s*\}/g,
      `maven {
            url 'https://www.jitpack.io'
            content {
                includeGroupByRegex("com\\\\.github\\\\..*")
            }
        }`,
    );

    // 2) bouncycastle 버전 강제 고정 (allprojects 블록 끝에 추가)
    const forceResolution = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'org.bouncycastle:bcprov-jdk15to18:1.81'
        }
    }
}`;

    buildGradle += forceResolution;

    config.modResults.contents = buildGradle;
    return config;
  });
};

module.exports = withJitpackFilter;
