const { withGradleProperties } = require('expo/config-plugins');

/**
 * Gradle JVM 메모리 상향으로 릴리즈 빌드 OOM(Metaspace)을 방지합니다.
 *
 * prebuild 기본값(-Xmx2048m -XX:MaxMetaspaceSize=512m)은 SDK 57 규모의
 * 릴리즈 빌드(Kotlin 컴파일 + lintVitalAnalyzeRelease 병렬 실행)에서
 * Metaspace가 고갈되어 `OutOfMemoryError: Metaspace`로 실패합니다.
 */
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError';

const withGradleJvmArgs = (config) => {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'),
    );

    properties.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: JVM_ARGS,
    });

    config.modResults = properties;
    return config;
  });
};

module.exports = withGradleJvmArgs;
