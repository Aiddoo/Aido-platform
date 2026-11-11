import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { TOKEN_REUSE_GRACE_PERIOD_MS } from "./auth.constants.js";

describe("AuthSession — refresh 토큰 회전과 재사용 판단", () => {
  it("만료 시각과 같은 순간까지 유효하고 그 뒤는 만료, 폐기가 만료보다 먼저다", () => {
    // Given
    const session = createAuthSessionFixture({ expiresAt: AUTH_FIXTURE_NOW });
    const revoked = createAuthSessionFixture({
      expiresAt: AUTH_FIXTURE_NOW.subtract({ hours: 1 }),
      revokedAt: AUTH_FIXTURE_NOW.subtract({ hours: 2 }),
    });

    // When
    const validities = [
      session.validityAt(AUTH_FIXTURE_NOW),
      session.validityAt(AUTH_FIXTURE_NOW.add({ milliseconds: 1 })),
      revoked.validityAt(AUTH_FIXTURE_NOW),
    ];

    // Then
    expect(validities).toEqual(["valid", "expired", "revoked"]);
  });

  it("직전 토큰이 grace 안에 다시 오면 재시도로, 넘으면 재사용으로 본다", () => {
    // Given
    const session = createAuthSessionFixture({
      previousTokenHash: "previous-hash",
      lastUsedAt: AUTH_FIXTURE_NOW,
    });
    const atGraceEnd = AUTH_FIXTURE_NOW.add({ milliseconds: TOKEN_REUSE_GRACE_PERIOD_MS });

    // When
    const outcomes = [
      session.isRetryWithin("previous-hash", atGraceEnd, TOKEN_REUSE_GRACE_PERIOD_MS),
      session.isRetryWithin(
        "previous-hash",
        atGraceEnd.add({ milliseconds: 1 }),
        TOKEN_REUSE_GRACE_PERIOD_MS,
      ),
      session.isRetryWithin("other-hash", AUTH_FIXTURE_NOW, TOKEN_REUSE_GRACE_PERIOD_MS),
    ];

    // Then
    expect(outcomes).toEqual([true, false, false]);
  });

  it("회전 계획은 현재 hash를 직전 hash로 남기고 버전 조건을 함께 싣는다", () => {
    // Given
    const session = createAuthSessionFixture({ refreshTokenHash: "current-hash", tokenVersion: 3 });
    const expiresAt = AUTH_FIXTURE_NOW.add({ hours: 24 * 7 });

    // When
    const rotation = session.planRotation("next-hash", expiresAt);

    // Then
    expect(rotation).toEqual({
      refreshTokenHash: "next-hash",
      tokenVersion: 4,
      previousTokenHash: "current-hash",
      expectedTokenVersion: 3,
      expiresAt,
    });
  });

  it("소유자 확인은 사용자 id 값으로 비교한다", () => {
    // Given
    const session = createAuthSessionFixture();

    // When
    const isOwner = session.isOwnedBy(UserId.reconstitute(AUTH_FIXTURE_USER_ID));
    const isOther = session.isOwnedBy(UserId.reconstitute("other-user"));

    // Then
    expect([isOwner, isOther]).toEqual([true, false]);
  });
});
