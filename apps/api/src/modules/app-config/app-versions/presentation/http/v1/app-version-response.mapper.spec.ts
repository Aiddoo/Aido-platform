import { createAppReleaseFixture } from "#test/fixtures/app-config/app-release.fixture";

import { toAppVersionResponse } from "./app-version-response.mapper.js";

describe("toAppVersionResponse — 앱 버전 응답", () => {
  it("릴리스가 없거나 한 플랫폼만 있으면 비활성만 보낸다", () => {
    // Given
    const iosOnly = [createAppReleaseFixture({ platform: "ios", latestVersion: "1.9.1" })];

    // Then
    expect(toAppVersionResponse([])).toEqual({ enabled: false });
    expect(toAppVersionResponse(iosOnly)).toEqual({ enabled: false });
  });

  it("두 플랫폼의 최신 버전을 플랫폼별로 보낸다", () => {
    // Given
    const releases = [
      createAppReleaseFixture({ platform: "android", latestVersion: "1.9.2" }),
      createAppReleaseFixture({ platform: "ios", latestVersion: "1.9.1" }),
    ];

    // Then
    expect(toAppVersionResponse(releases)).toEqual({
      enabled: true,
      ios: { latestVersion: "1.9.1" },
      android: { latestVersion: "1.9.2" },
    });
  });
});
