import {
  compareSemanticVersions,
  featureDiscoveryMinAppVersionPattern,
  isSemanticVersionAtLeast,
  semanticVersionPattern,
} from "../src/index.js";

describe("semantic-version", () => {
  it("feature discovery 최소 버전 패턴은 공용 semver 패턴을 재사용한다", () => {
    expect(featureDiscoveryMinAppVersionPattern).toBe(semanticVersionPattern);
  });

  describe("compareSemanticVersions", () => {
    it.each([
      ["1.10.1", "1.10.1", 0],
      ["1.10.2", "1.10.1", 1],
      ["1.9.9", "1.10.0", -1],
      ["2.0.0", "1.99.99", 1],
      ["1.10.1+build.5", "1.10.1", 0],
    ])("%s 와 %s 를 비교한다", (left, right, expectedSign) => {
      expect(Math.sign(compareSemanticVersions(left, right) ?? Number.NaN)).toBe(expectedSign);
    });

    it("SemVer 2.0.0 spec의 프리릴리스 우선순위를 따른다", () => {
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
        expect(compareSemanticVersions(lower, higher)).toBeLessThan(0);
        expect(compareSemanticVersions(higher, lower)).toBeGreaterThan(0);
      }
    });

    it.each([null, undefined, "", "1.10", "v1.10.1", "01.2.3", "1.2.3-", "latest"])(
      "유효하지 않은 값 %s 은 null을 반환한다",
      (invalid) => {
        expect(compareSemanticVersions(invalid, "1.0.0")).toBeNull();
        expect(compareSemanticVersions("1.0.0", invalid)).toBeNull();
      },
    );
  });

  describe("isSemanticVersionAtLeast", () => {
    it("최소 버전 이상이면 true", () => {
      expect(isSemanticVersionAtLeast("1.10.1", "1.10.1")).toBe(true);
      expect(isSemanticVersionAtLeast("1.11.0", "1.10.1")).toBe(true);
    });

    it("최소 버전 미만이면 false", () => {
      expect(isSemanticVersionAtLeast("1.10.0", "1.10.1")).toBe(false);
    });

    it("프리릴리스는 같은 core의 정식 버전보다 낮다", () => {
      expect(isSemanticVersionAtLeast("1.10.1-rc.1", "1.10.1")).toBe(false);
      expect(isSemanticVersionAtLeast("1.10.2-rc.1", "1.10.1")).toBe(true);
      expect(isSemanticVersionAtLeast("1.10.1", "1.10.1-rc.1")).toBe(true);
    });

    it("버전이 없거나 유효하지 않으면 false", () => {
      expect(isSemanticVersionAtLeast(null, "1.10.1")).toBe(false);
      expect(isSemanticVersionAtLeast(undefined, "1.10.1")).toBe(false);
      expect(isSemanticVersionAtLeast("garbage", "1.10.1")).toBe(false);
    });
  });
});
