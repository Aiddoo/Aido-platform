import {
  compareSemanticVersions,
  featureDiscoveryMinAppVersionPattern,
  isSemanticVersionAtLeast,
  semanticVersionPattern,
} from "../src/index.js";

describe("semantic-version", () => {
  it("feature discovery 최소 버전 패턴은 공용 semver 패턴을 재사용한다", () => {
    // When
    const pattern = featureDiscoveryMinAppVersionPattern;

    // Then
    expect(pattern).toBe(semanticVersionPattern);
  });

  describe("compareSemanticVersions", () => {
    it.each([
      ["1.10.1", "1.10.1", 0],
      ["1.10.2", "1.10.1", 1],
      ["1.9.9", "1.10.0", -1],
      ["2.0.0", "1.99.99", 1],
      ["1.10.1+build.5", "1.10.1", 0],
    ])("%s 와 %s 를 비교한다", (left, right, expectedSign) => {
      // When
      const result = compareSemanticVersions(left, right);

      // Then
      expect(Math.sign(result ?? Number.NaN)).toBe(expectedSign);
    });

    it("SemVer 2.0.0 spec의 프리릴리스 우선순위를 따른다", () => {
      // Given
      const ascending = [
        "1.0.0-alpha",
        "1.0.0-alpha.1",
        "1.0.0-alpha.beta",
        "1.0.0-beta",
        "1.0.0-beta.2",
        "1.0.0-beta.11",
        "1.0.0-rc.1",
        "1.0.0",
      ];
      for (let index = 1; index < ascending.length; index += 1) {
        const lower = ascending[index - 1];
        const higher = ascending[index];

        // When
        const forward = compareSemanticVersions(lower, higher);
        const backward = compareSemanticVersions(higher, lower);

        // Then
        expect(forward).toBeLessThan(0);
        expect(backward).toBeGreaterThan(0);
      }
    });

    it.each([null, undefined, "", "1.10", "v1.10.1", "01.2.3", "1.2.3-", "latest"])(
      "유효하지 않은 값 %s 은 null을 반환한다",
      (invalid) => {
        // When
        const invalidLeft = compareSemanticVersions(invalid, "1.0.0");
        const invalidRight = compareSemanticVersions("1.0.0", invalid);

        // Then
        expect(invalidLeft).toBeNull();
        expect(invalidRight).toBeNull();
      },
    );
  });

  describe("isSemanticVersionAtLeast", () => {
    it("최소 버전 이상이면 true", () => {
      // When
      const sameVersion = isSemanticVersionAtLeast("1.10.1", "1.10.1");
      const newerVersion = isSemanticVersionAtLeast("1.11.0", "1.10.1");

      // Then
      expect(sameVersion).toBe(true);
      expect(newerVersion).toBe(true);
    });

    it("최소 버전 미만이면 false", () => {
      // When
      const result = isSemanticVersionAtLeast("1.10.0", "1.10.1");

      // Then
      expect(result).toBe(false);
    });

    it("프리릴리스는 같은 core의 정식 버전보다 낮다", () => {
      // When
      const sameCorePrerelease = isSemanticVersionAtLeast("1.10.1-rc.1", "1.10.1");
      const newerCorePrerelease = isSemanticVersionAtLeast("1.10.2-rc.1", "1.10.1");
      const releaseOverPrerelease = isSemanticVersionAtLeast("1.10.1", "1.10.1-rc.1");

      // Then
      expect(sameCorePrerelease).toBe(false);
      expect(newerCorePrerelease).toBe(true);
      expect(releaseOverPrerelease).toBe(true);
    });

    it("버전이 없거나 유효하지 않으면 false", () => {
      // When
      const nullVersion = isSemanticVersionAtLeast(null, "1.10.1");
      const undefinedVersion = isSemanticVersionAtLeast(undefined, "1.10.1");
      const garbageVersion = isSemanticVersionAtLeast("garbage", "1.10.1");

      // Then
      expect(nullVersion).toBe(false);
      expect(undefinedVersion).toBe(false);
      expect(garbageVersion).toBe(false);
    });
  });
});
