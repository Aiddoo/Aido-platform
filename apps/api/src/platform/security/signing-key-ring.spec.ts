import { parseSigningKeys, SigningKeyRing } from "./signing-key-ring.js";

const legacySecret = "legacy-jwt-secret-at-least-32-characters";
const currentSecret = "current-signing-secret-at-least-32-chars";
const previousSecret = "previous-signing-secret-at-least-32-char";

describe("SigningKeyRing", () => {
  it.each([undefined, "", "   "])("설정이 %j이면 기존 비밀값 하나로 서명한다", (configured) => {
    // Given
    const params = { configured, legacySecret };

    // When
    const ring = SigningKeyRing.fromEnv(params);

    // Then
    expect(ring.current).toEqual({ kid: "legacy", secret: legacySecret });
    expect(ring.current).toBe(ring.legacy);
    expect(ring.find("legacy")).toBeNull();
  });

  it("첫 항목을 현재 서명 키로 쓰고 나머지 키와 기존 비밀값으로도 검증할 수 있다", () => {
    // Given
    const configured = `k2:${currentSecret}, k1:${previousSecret}`;

    // When
    const ring = SigningKeyRing.fromEnv({ configured, legacySecret });

    // Then
    expect(ring.current).toEqual({ kid: "k2", secret: currentSecret });
    expect(ring.find("k1")).toEqual({ kid: "k1", secret: previousSecret });
    expect(ring.find("unknown")).toBeNull();
    expect(ring.legacy).toEqual({ kid: "legacy", secret: legacySecret });
  });

  it("비밀값에 쌍점이 있어도 첫 쌍점에서만 나눈다", () => {
    // Given
    const secret = `a:b:${currentSecret}`;

    // When
    const ring = SigningKeyRing.fromEnv({ configured: `k1:${secret}`, legacySecret });

    // Then
    expect(ring.current).toEqual({ kid: "k1", secret });
  });

  it("형식이 틀린 설정이면 만들지 않는다", () => {
    // Given
    const configured = `k1:short`;

    // When / Then
    expect(() => SigningKeyRing.fromEnv({ configured, legacySecret })).toThrow();
  });
});

describe("parseSigningKeys", () => {
  it.each([
    ["32자 미만 비밀값", `k1:${"x".repeat(31)}`],
    ["쌍점 없는 항목", currentSecret],
    ["빈 kid", `:${currentSecret}`],
    ["토큰에 실을 수 없는 kid 문자", `k.1:${currentSecret}`],
    ["중복 kid", `k1:${currentSecret},k1:${previousSecret}`],
    ["빈 항목", `k1:${currentSecret},,k2:${previousSecret}`],
  ])("%s는 거절한다", (_, configured) => {
    // Given
    const value = configured;

    // When
    const result = parseSigningKeys(value);

    // Then
    expect(result.success).toBe(false);
  });

  it("kid와 32자 이상 비밀값 목록을 읽는다", () => {
    // Given
    const configured = `2026-11_a:${currentSecret},k1:${previousSecret}`;

    // When
    const result = parseSigningKeys(configured);

    // Then
    expect(result).toEqual({
      success: true,
      keys: [
        { kid: "2026-11_a", secret: currentSecret },
        { kid: "k1", secret: previousSecret },
      ],
    });
  });
});
