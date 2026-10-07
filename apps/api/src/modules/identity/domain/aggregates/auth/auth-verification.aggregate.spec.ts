import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { VerificationFixture } from "#test/fixtures/index";

import { AuthVerification } from "./auth-verification.aggregate.js";

const at = new Date("2026-12-31T23:59:00.000Z");
const expiresAt = new Date("2027-01-01T00:00:00.000Z");

const createVerification = (overrides: Parameters<typeof VerificationFixture.create>[0] = {}) =>
  AuthVerification.reconstitute(VerificationFixture.create({ expiresAt, ...overrides }));

describe("AuthVerification — 인증 소비와 시도 제한", () => {
  it.each([
    ["만료 직전", new Date("2026-12-31T23:59:59.999Z"), "valid"],
    ["만료와 동일한 시각", expiresAt, "expired"],
    ["만료 직후", new Date("2027-01-01T00:00:00.001Z"), "expired"],
  ])(
    "%s의 인증 가능 여부를 기존 만료 경계에 맞게 판정한다",
    (_description, checkedAt, validity) => {
      // Given
      const verification = createVerification();

      // When
      const result = verification.validityAt(checkedAt);

      // Then
      expect(result).toBe(validity);
    },
  );

  it("시도 한도의 직전까지 유효하며 한도에 도달하면 소비하지 않는다", () => {
    // Given
    const allowed = createVerification({ attempts: VERIFICATION_CODE.MAX_ATTEMPTS - 1 });
    const exhausted = createVerification({ attempts: VERIFICATION_CODE.MAX_ATTEMPTS });

    // When / Then
    expect(allowed.validityAt(at)).toBe("valid");
    expect(exhausted.validityAt(at)).toBe("exhausted");
    expect(exhausted.consume(at)).toBe(false);
    expect(exhausted.usedAt).toBeNull();
  });

  it("이미 사용되거나 만료된 인증은 시도 한도 오류보다 우선하여 거부한다", () => {
    // Given
    const used = createVerification({ usedAt: at, attempts: VERIFICATION_CODE.MAX_ATTEMPTS });
    const expired = createVerification({ expiresAt: at, attempts: VERIFICATION_CODE.MAX_ATTEMPTS });

    // When / Then
    expect(used.validityAt(expiresAt)).toBe("used");
    expect(expired.validityAt(at)).toBe("expired");
    expect(used.consume(at)).toBe(false);
    expect(expired.consume(at)).toBe(false);
  });

  it("유효한 인증을 한 번만 소비하고 외부 Date 변경으로 상태를 바꾸지 않는다", () => {
    // Given
    const originalExpiry = new Date(expiresAt);
    const consumedAt = new Date(at);
    const verification = createVerification({ expiresAt: originalExpiry });
    originalExpiry.setUTCFullYear(2000);

    // When
    const consumed = verification.consume(consumedAt);
    consumedAt.setUTCFullYear(2000);
    verification.usedAt?.setUTCFullYear(2000);

    // Then
    expect(consumed).toBe(true);
    expect(verification.usedAt).toEqual(at);
    expect(verification.validityAt(at)).toBe("used");
    expect(verification.consume(at)).toBe(false);
    expect(verification.usedAt).toEqual(at);
  });
});
