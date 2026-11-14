import { createAppReleaseFixture } from "#test/fixtures/app-config/app-release.fixture";

import type { AppConfigAppVersionsConfig } from "../../app-config-app-versions.config.js";
import type { AppRelease } from "../../domain/app-release.aggregate.js";
import { withEnvironmentFallback } from "./app-release-env.mapper.js";

function createConfig(
  overrides: Partial<AppConfigAppVersionsConfig> = {},
): AppConfigAppVersionsConfig {
  return {
    enabled: true,
    iosLatestVersion: "1.9.1",
    androidLatestVersion: "1.9.2",
    ...overrides,
  };
}

function toVersionByPlatform(releases: readonly AppRelease[]): Record<string, string> {
  return Object.fromEntries(
    releases.map((release) => [release.platform, release.latestVersion.value]),
  );
}

describe("withEnvironmentFallback — DB에 없는 플랫폼의 env 대체", () => {
  it("DB에 행이 없으면 두 플랫폼 모두 env 값이다", () => {
    // Given
    const config = createConfig();

    // When
    const releases = withEnvironmentFallback([], config);

    // Then
    expect(toVersionByPlatform(releases)).toEqual({ ios: "1.9.1", android: "1.9.2" });
  });

  it("DB에 있는 플랫폼은 DB 값이고 없는 플랫폼만 env 값이다", () => {
    // Given
    const stored = [createAppReleaseFixture({ platform: "ios", latestVersion: "1.10.0" })];

    // When
    const releases = withEnvironmentFallback(stored, createConfig());

    // Then
    expect(toVersionByPlatform(releases)).toEqual({ ios: "1.10.0", android: "1.9.2" });
  });

  it("env 확인을 꺼도 DB에 있는 플랫폼은 그대로 주고 없는 플랫폼은 채우지 않는다", () => {
    // Given
    const stored = [createAppReleaseFixture({ platform: "android", latestVersion: "1.10.0" })];

    // When
    const releases = withEnvironmentFallback(stored, createConfig({ enabled: false }));

    // Then
    expect(toVersionByPlatform(releases)).toEqual({ android: "1.10.0" });
  });

  it("env에 버전이 없는 플랫폼은 채우지 않는다", () => {
    // Given
    const config = createConfig({ androidLatestVersion: undefined });

    // When
    const releases = withEnvironmentFallback([], config);

    // Then
    expect(toVersionByPlatform(releases)).toEqual({ ios: "1.9.1" });
  });
});
