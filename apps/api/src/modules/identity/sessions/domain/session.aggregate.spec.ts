import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createSessionFixture,
} from "#test/fixtures/identity/session.fixture";

import { TOKEN_REUSE_GRACE_PERIOD_MS } from "./sessions.constants.js";

describe("Session — refresh 토큰 회전과 재사용 판단", () => {
  it("만료 시각과 같은 순간까지 유효하고 그 뒤는 만료, 폐기가 만료보다 먼저다", () => {
    // Given
    const session = createSessionFixture({ expiresAt: AUTH_FIXTURE_NOW });
    const revoked = createSessionFixture({
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
    const session = createSessionFixture({
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

  it("회전은 현재 hash를 직전 hash로 남기고 버전을 올리며 읽을 때의 버전을 저장 조건으로 둔다", () => {
    // Given
    const session = createSessionFixture({ refreshTokenHash: "current-hash", tokenVersion: 3 });
    const expiresAt = AUTH_FIXTURE_NOW.add({ hours: 24 * 7 });

    // When
    const rotated = session.rotate({
      refreshTokenHash: "next-hash",
      expiresAt,
      now: AUTH_FIXTURE_NOW,
    });

    // Then
    expect(rotated).toBe(true);
    expect(session.toPrimitives()).toMatchObject({
      refreshTokenHash: "next-hash",
      tokenVersion: 4,
      previousTokenHash: "current-hash",
      expiresAt,
      lastUsedAt: AUTH_FIXTURE_NOW,
    });
    expect({
      persistedTokenVersion: session.persistedTokenVersion,
      rotated: session.hasRotatedSinceLoad(),
    }).toEqual({ persistedTokenVersion: 3, rotated: true });
  });

  it("폐기한 세션은 회전하지 않고 SESSION_0703이다", () => {
    // Given
    const session = createSessionFixture({ revokedAt: AUTH_FIXTURE_NOW });

    // When
    const rotate = () =>
      session.rotate({
        refreshTokenHash: "next-hash",
        expiresAt: AUTH_FIXTURE_NOW.add({ hours: 1 }),
        now: AUTH_FIXTURE_NOW,
      });

    // Then
    expect(rotate).toThrow(expect.objectContaining({ errorCode: "SESSION_0703" }));
  });

  it("두 번째 폐기는 false이고 처음 폐기 시각과 사유를 그대로 둔다", () => {
    // Given
    const session = createSessionFixture();
    const later = AUTH_FIXTURE_NOW.add({ minutes: 5 });

    // When
    const first = session.revoke("USER_LOGOUT", AUTH_FIXTURE_NOW);
    const second = session.revoke("USER_REVOKE", later);

    // Then
    expect({ first, second }).toEqual({ first: true, second: false });
    expect(session.toPrimitives()).toMatchObject({
      revokedAt: AUTH_FIXTURE_NOW,
      revokedReason: "USER_LOGOUT",
    });
  });

  it("소유자 확인은 사용자 id 값으로 비교한다", () => {
    // Given
    const session = createSessionFixture();

    // When
    const isOwner = session.isOwnedBy(UserId.reconstitute(AUTH_FIXTURE_USER_ID));
    const isOther = session.isOwnedBy(UserId.reconstitute("other-user"));

    // Then
    expect([isOwner, isOther]).toEqual([true, false]);
  });
});
