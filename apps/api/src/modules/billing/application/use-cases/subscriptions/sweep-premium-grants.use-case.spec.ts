import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { PREMIUM_GRANT_SWEEP, SweepPremiumGrants } from "./sweep-premium-grants.use-case.js";

const NOW = new Date("2028-03-04T00:00:00.000Z");

function createSweep(pages: readonly (readonly string[])[], failingUserIds: ReadonlySet<string>) {
  const requestedCursors: (string | undefined)[] = [];
  const projectedUserIds: string[] = [];
  const invalidatedUserIds: string[] = [];
  const logger = mock<ApplicationLogger>();
  const sweep = new SweepPremiumGrants({
    premiumGrantRepository: {
      findUserIdsToReconcile: async ({ afterUserId }) => {
        requestedCursors.push(afterUserId);
        return [...(pages[requestedCursors.length - 1] ?? [])];
      },
    },
    premiumAccessProjector: {
      project: async ({ userId }) => {
        if (failingUserIds.has(userId)) throw new Error("projection failed");
        projectedUserIds.push(userId);
        return {
          access: {
            source: null,
            endsAt: null,
            periodEndsAt: null,
            willRenew: false,
            bankedDays: 0,
            recentGrantEndedAt: null,
          },
          userState: { subscriptionStatus: "FREE", subscriptionExpiresAt: null },
          changedGrantCount: 1,
        };
      },
    },
    userMutationLock: { lockById: async () => true },
    unitOfWork: createUnitOfWorkMock(),
    cache: {
      invalidate: async (userId) => {
        invalidatedUserIds.push(userId);
      },
    },
    logger,
  });
  return { sweep, requestedCursors, projectedUserIds, invalidatedUserIds, logger };
}

describe("SweepPremiumGrants", () => {
  it("가득 찬 묶음 뒤에는 마지막 userId 다음부터 이어 읽고 덜 찬 묶음에서 멈춘다", async () => {
    // Given
    const firstPage = Array.from(
      { length: PREMIUM_GRANT_SWEEP.BATCH_SIZE },
      (_, index) => `user-${String(index).padStart(4, "0")}`,
    );
    const { sweep, requestedCursors } = createSweep([firstPage, ["user-9999"]], new Set());

    // When
    const result = await sweep.execute({ now: NOW });

    // Then
    expect(requestedCursors).toEqual([undefined, firstPage.at(-1)]);
    expect(result).toEqual({
      userCount: PREMIUM_GRANT_SWEEP.BATCH_SIZE + 1,
      changedGrantCount: PREMIUM_GRANT_SWEEP.BATCH_SIZE + 1,
      failedUserCount: 0,
      hasRemaining: false,
    });
  });

  it("한 사용자의 정리가 실패해도 나머지 사용자를 처리하고 실패를 오류 로그로 남긴다", async () => {
    // Given
    const { sweep, projectedUserIds, invalidatedUserIds, logger } = createSweep(
      [["user-a", "user-b", "user-c"]],
      new Set(["user-b"]),
    );

    // When
    const result = await sweep.execute({ now: NOW });

    // Then
    expect(projectedUserIds).toEqual(["user-a", "user-c"]);
    expect(invalidatedUserIds).toEqual(["user-a", "user-c"]);
    expect(result).toMatchObject({ failedUserCount: 1, changedGrantCount: 2 });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b", errorType: "Error" }),
    );
  });
});
