import type { AppConfigAppVersionsConfig } from "../../app-config-app-versions.config.js";
import { toAppReleases } from "./app-release-env.mapper.js";

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

describe("toAppReleases — 환경 설정의 최신 앱 버전", () => {
  it("확인을 끄면 릴리스가 없다", () => {
    // Given
    const config = createConfig({ enabled: false });

    // Then
    expect(toAppReleases(config)).toEqual([]);
  });

  it("한 플랫폼이라도 버전이 없으면 릴리스가 없다", () => {
    // Given
    const config = createConfig({ androidLatestVersion: undefined });

    // Then
    expect(toAppReleases(config)).toEqual([]);
  });

  it("두 플랫폼의 최신 버전을 릴리스로 돌려준다", () => {
    // Given
    const config = createConfig();

    // When
    const releases = toAppReleases(config).map((release) => release.toPrimitives());

    // Then
    expect(releases).toEqual([
      { platform: "ios", latestVersion: "1.9.1" },
      { platform: "android", latestVersion: "1.9.2" },
    ]);
  });
});
