import { ErrorCode } from "@aido/api/errors";

import {
  AUTH_FIXTURE_NOW,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

const GRACE = { hours: 24 * 30 } as const;

describe("IdentityUser — 탈퇴 유예·복구·영구 삭제 판단", () => {
  it("탈퇴를 요청하면 정지 상태와 탈퇴 시각을 두고, 다시 요청하면 USER_0606이다", () => {
    // Given
    const user = createIdentityUserFixture();

    // When
    user.requestDeletion(AUTH_FIXTURE_NOW);

    // Then
    expect(user.toPrimitives()).toMatchObject({ status: "SUSPENDED", deletedAt: AUTH_FIXTURE_NOW });
    expect(() => user.requestDeletion(AUTH_FIXTURE_NOW)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.USER_0606 }),
    );
  });

  it("유예 30일 안이면 복구하고 true, 탈퇴하지 않은 계정은 바꾸지 않고 false다", () => {
    // Given
    const deleted = createIdentityUserFixture({
      status: "SUSPENDED",
      deletedAt: AUTH_FIXTURE_NOW.subtract(GRACE).add({ milliseconds: 1 }),
    });
    const active = createIdentityUserFixture();

    // When
    const outcomes = [deleted.restore(AUTH_FIXTURE_NOW), active.restore(AUTH_FIXTURE_NOW)];

    // Then
    expect(outcomes).toEqual([true, false]);
    expect(deleted.toPrimitives()).toMatchObject({ status: "ACTIVE", deletedAt: null });
  });

  it("유예 경계에 닿으면 복구할 수 없어 USER_0606이고, 경계를 지난 계정만 영구 삭제 대상이다", () => {
    // Given
    const atBoundary = createIdentityUserFixture({ deletedAt: AUTH_FIXTURE_NOW.subtract(GRACE) });
    const pastBoundary = createIdentityUserFixture({
      deletedAt: AUTH_FIXTURE_NOW.subtract(GRACE).subtract({ milliseconds: 1 }),
    });

    // When
    const restore = () => atBoundary.requiresRestoration(AUTH_FIXTURE_NOW);

    // Then
    expect(restore).toThrow(expect.objectContaining({ errorCode: ErrorCode.USER_0606 }));
    expect(atBoundary.isPurgeEligibleAt(AUTH_FIXTURE_NOW)).toBe(false);
    expect(pastBoundary.isPurgeEligibleAt(AUTH_FIXTURE_NOW)).toBe(true);
  });
});
