import { SessionFixture } from "#test/fixtures/index";

import { AuthSession } from "./auth-session.aggregate.js";

const lastUsedAt = new Date("2026-12-31T23:59:50.000Z");
const expiresAt = new Date("2027-01-01T00:00:00.000Z");
const createSession = (overrides: Parameters<typeof SessionFixture.create>[0] = {}) =>
  AuthSession.reconstitute(
    SessionFixture.create({
      userId: "user-1",
      refreshTokenHash: "current-hash",
      previousTokenHash: "previous-hash",
      tokenVersion: 3,
      lastUsedAt,
      expiresAt,
      ...overrides,
    }),
  );

describe("AuthSession — 세션 소유권과 토큰 유효성", () => {
  it("세션 폐기 권한은 세션 소유자에게만 부여한다", () => {
    // Given
    const session = createSession();

    // When / Then
    expect(session.isOwnedBy("user-1")).toBe(true);
    expect(session.isOwnedBy("other-user")).toBe(false);
  });

  it.each([
    ["만료 직전", new Date("2026-12-31T23:59:59.999Z"), "valid"],
    ["만료와 동일한 시각", expiresAt, "valid"],
    ["만료 1ms 이후", new Date("2027-01-01T00:00:00.001Z"), "expired"],
  ])("%s의 유효성을 기존 만료 경계에 맞게 판정한다", (_description, at, validity) => {
    // Given
    const session = createSession();

    // When
    const result = session.validityAt(at);

    // Then
    expect(result).toBe(validity);
  });

  it("폐기된 세션은 만료 여부와 무관하게 폐기 상태로 판정한다", () => {
    // Given
    const session = createSession({ revokedAt: lastUsedAt });

    // When
    const result = session.validityAt(new Date("2027-01-02T00:00:00.000Z"));

    // Then
    expect(result).toBe("revoked");
    expect(session.isRevoked()).toBe(true);
  });

  it("직전 토큰은 연도를 넘는 grace period 경계까지 재시도를 허용한다", () => {
    // Given
    const session = createSession();

    // When / Then
    expect(session.isRetryWithin("previous-hash", expiresAt, 10_000)).toBe(true);
    expect(
      session.isRetryWithin("previous-hash", new Date("2027-01-01T00:00:00.001Z"), 10_000),
    ).toBe(false);
    expect(session.isRetryWithin("unknown-hash", lastUsedAt, 10_000)).toBe(false);
  });

  it("복원에 사용한 Date가 바뀌어도 유효성과 재시도 판정은 변하지 않는다", () => {
    // Given
    const originalExpiry = new Date(expiresAt);
    const originalLastUse = new Date(lastUsedAt);
    const session = createSession({ expiresAt: originalExpiry, lastUsedAt: originalLastUse });

    // When
    originalExpiry.setUTCFullYear(2000);
    originalLastUse.setUTCFullYear(2000);

    // Then
    expect(session.validityAt(expiresAt)).toBe("valid");
    expect(session.isRetryWithin("previous-hash", expiresAt, 10_000)).toBe(true);
  });

  it("현재 버전을 조건으로 회전 계획을 만들고 전달한 만료일의 변경과 격리한다", () => {
    // Given
    const session = createSession();
    const nextExpiry = new Date("2027-01-08T00:00:00.000Z");

    // When
    const plan = session.planRotation("next-hash", "current-hash", nextExpiry);
    nextExpiry.setUTCFullYear(2000);

    // Then
    expect(plan).toEqual({
      refreshTokenHash: "next-hash",
      tokenVersion: 4,
      previousTokenHash: "current-hash",
      expectedTokenVersion: 3,
      expiresAt: new Date("2027-01-08T00:00:00.000Z"),
    });
    expect(session.tokenVersion).toBe(3);
  });
});
