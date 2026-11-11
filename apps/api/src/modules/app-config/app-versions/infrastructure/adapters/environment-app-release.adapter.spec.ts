import { EnvironmentAppReleaseAdapter } from "./environment-app-release.adapter.js";

interface AppVersionConfig {
  enabled: boolean;
  iosLatestVersion: string | undefined;
  androidLatestVersion: string | undefined;
}

function createAdapter(appVersion: AppVersionConfig) {
  return new EnvironmentAppReleaseAdapter(appVersion);
}

describe("EnvironmentAppReleaseAdapter — 환경 설정의 최신 앱 버전", () => {
  it("확인을 끄면 릴리스가 없다", () => {
    // Given
    const adapter = createAdapter({
      enabled: false,
      iosLatestVersion: "1.9.1",
      androidLatestVersion: "1.9.2",
    });

    // Then
    expect(adapter.listLatestReleases()).toEqual([]);
  });

  it("한 플랫폼이라도 버전이 없으면 릴리스가 없다", () => {
    // Given
    const adapter = createAdapter({
      enabled: true,
      iosLatestVersion: "1.9.1",
      androidLatestVersion: undefined,
    });

    // Then
    expect(adapter.listLatestReleases()).toEqual([]);
  });

  it("두 플랫폼의 최신 버전을 릴리스로 돌려준다", () => {
    // Given
    const adapter = createAdapter({
      enabled: true,
      iosLatestVersion: "1.9.1",
      androidLatestVersion: "1.9.2",
    });

    // When
    const releases = adapter.listLatestReleases().map((release) => release.toPrimitives());

    // Then
    expect(releases).toEqual([
      { platform: "ios", latestVersion: "1.9.1" },
      { platform: "android", latestVersion: "1.9.2" },
    ]);
  });
});
