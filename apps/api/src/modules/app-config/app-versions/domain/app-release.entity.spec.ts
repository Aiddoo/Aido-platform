import { createAppReleaseFixture } from "#test/fixtures/app-config/app-release.fixture";

describe("AppRelease — 스토어 최신 릴리스", () => {
  it.each([
    ["1.9.0", true],
    ["1.8.9", true],
    ["0.99.99", true],
    ["1.9.1", false],
    ["1.9.2", false],
    ["2.0.0", false],
  ])("앱 %s는 최신 1.9.1보다 낮을 때만 업데이트가 필요하다 (%s)", (clientVersion, expected) => {
    // Given
    const release = createAppReleaseFixture({ latestVersion: "1.9.1" });

    // When
    const isRequired = release.isUpdateRequired(clientVersion);

    // Then
    expect(isRequired).toBe(expected);
  });

  it("앱 버전을 모르거나 SemVer가 아니면 업데이트를 강요하지 않는다", () => {
    // Given
    const release = createAppReleaseFixture({ latestVersion: "1.9.1" });

    // Then
    expect(release.isUpdateRequired(null)).toBe(false);
    expect(release.isUpdateRequired("1.9")).toBe(false);
    expect(release.isUpdateRequired("not-a-version")).toBe(false);
  });

  it("프리릴리스는 같은 번호의 정식 릴리스보다 낮다", () => {
    // Given
    const release = createAppReleaseFixture({ latestVersion: "1.9.1" });

    // Then
    expect(release.isUpdateRequired("1.9.1-beta.1")).toBe(true);
  });
});
