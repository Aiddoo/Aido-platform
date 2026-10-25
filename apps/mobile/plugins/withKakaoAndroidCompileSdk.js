const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @generated withKakaoAndroidCompileSdk';

/**
 * @react-native-kakao 2.4.11 (and 3.1.0) hard-code `compileSdk 33` in core/package.json.
 * React Native 0.88 and AndroidX (core 1.13, appcompat 1.7, window 1.5) require consumers to
 * compile against 34+, so `:react-native-kakao_*:checkReleaseAarMetadata` fails the release build.
 *
 * Align only those library modules with the app's compileSdk (Expo root project ext) through
 * AGP's `finalizeDsl`, which runs after the module's own `android {}` block. Their minSdk,
 * targetSdk and Kakao SDK versions are unchanged.
 */
const KAKAO_COMPILE_SDK_BLOCK = `
${MARKER}
subprojects { subproject ->
  if (subproject.name ==~ /^@?react-native-kakao_.+/) {
    subproject.plugins.withId('com.android.library') {
      subproject.androidComponents.finalizeDsl { android ->
        android.compileSdk = rootProject.ext.compileSdkVersion
      }
    }
  }
}
`;

function addKakaoCompileSdk(buildGradle) {
  if (buildGradle.includes(MARKER)) {
    return buildGradle;
  }
  return `${buildGradle.trimEnd()}\n${KAKAO_COMPILE_SDK_BLOCK}`;
}

const withKakaoAndroidCompileSdk = (config) =>
  withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('[withKakaoAndroidCompileSdk] Expected a Groovy android/build.gradle.');
    }
    config.modResults.contents = addKakaoCompileSdk(config.modResults.contents);
    return config;
  });

module.exports = withKakaoAndroidCompileSdk;
module.exports.addKakaoCompileSdk = addKakaoCompileSdk;
