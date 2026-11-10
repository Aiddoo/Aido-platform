import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserFixture } from "#test/fixtures/index";

import { IdentityUser } from "./identity-user.aggregate.js";

const at = new Date("2027-01-01T00:00:00.000Z");
const cutoff = new Date("2026-12-02T00:00:00.000Z");
const createUser = (deletedAt: Date | null = null) =>
  IdentityUser.reconstitute(UserFixture.create({ id: "user-1", status: "ACTIVE", deletedAt }));

describe("IdentityUser — 탈퇴와 복구 유예 기간", () => {
  it("탈퇴한 적이 없는 사용자는 복구나 영구 삭제가 필요하지 않다", () => {
    // Given
    const user = createUser();

    // When / Then
    expect(user.requiresRestoration(at)).toBe(false);
    expect(user.isPurgeEligibleAt(at)).toBe(false);
  });

  it.each([
    ["유예 기간 마지막 1ms", new Date(cutoff.getTime() + 1), true, false],
    ["유예 기간과 같은 시각", cutoff, false, false],
    ["유예 기간이 지난 1ms", new Date(cutoff.getTime() - 1), false, true],
  ])(
    "%s에서 복구와 영구 삭제의 기존 경계를 유지한다",
    (_label, deletedAt, restorable, purgeable) => {
      // Given
      const user = createUser(deletedAt);

      // When / Then
      if (restorable) {
        expect(user.requiresRestoration(at)).toBe(true);
      } else {
        expect(() => user.requiresRestoration(at)).toThrow(
          expect.objectContaining({ errorCode: ErrorCode.USER_0606, details: { userId: user.id } }),
        );
        expect(() => user.restore(at)).toThrow(DomainException);
        expect(user.deletedAt).toEqual(deletedAt);
      }
      expect(user.isPurgeEligibleAt(at)).toBe(purgeable);
    },
  );

  it("탈퇴 시각을 저장하고 중복 탈퇴를 기존 오류로 거부한다", () => {
    // Given
    const user = createUser();
    const requestedAt = new Date(at);

    // When
    user.requestDeletion(requestedAt);
    requestedAt.setUTCFullYear(2000);

    // Then
    expect(user.status).toBe("SUSPENDED");
    expect(user.deletedAt).toEqual(at);
    expect(() => user.requestDeletion(at)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.USER_0606, details: { userId: user.id } }),
    );
    expect(user.deletedAt).toEqual(at);
  });

  it("복구할 수 있는 계정의 상태와 탈퇴 시각을 함께 복원한다", () => {
    // Given
    const user = createUser(new Date(cutoff.getTime() + 1));

    // When
    user.restore(at);

    // Then
    expect(user.status).toBe("ACTIVE");
    expect(user.deletedAt).toBeNull();
    expect(user.requiresRestoration(at)).toBe(false);
    expect(user.isPurgeEligibleAt(at)).toBe(false);
  });

  it("외부 Date를 변경해도 계정의 유예 기간은 변경되지 않는다", () => {
    // Given
    const deletedAt = new Date(cutoff.getTime() + 1);
    const user = createUser(deletedAt);

    // When
    deletedAt.setUTCFullYear(2000);
    user.deletedAt?.setUTCFullYear(2000);

    // Then
    expect(user.requiresRestoration(at)).toBe(true);
    expect(user.isPurgeEligibleAt(at)).toBe(false);
  });
});
