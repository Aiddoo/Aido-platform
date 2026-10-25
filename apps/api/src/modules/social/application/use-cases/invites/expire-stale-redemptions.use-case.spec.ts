import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { ExpireStaleRedemptions } from "./expire-stale-redemptions.use-case.js";

function createMaintenance(isEnabled: boolean) {
  const scheduled: string[] = [];
  const maintenance = new ExpireStaleRedemptions({
    inviteRedemptionRepository: { expireJoinedBefore: async () => 2 },
    rewardGrantRepository: { findRetryableSourceIds: async () => ["redemption-1"] },
    rewardScheduler: {
      scheduleMany: async (redemptionIds) => {
        scheduled.push(...redemptionIds);
      },
    },
    inviteConfig: { isEnabled },
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLogger>(),
  });
  return { maintenance, scheduled };
}

describe("ExpireStaleRedemptions", () => {
  it.each([
    {
      isEnabled: true,
      expected: { expiredCount: 2, retriedCount: 1 },
      scheduled: ["redemption-1"],
    },
    { isEnabled: false, expected: { expiredCount: 2, retriedCount: 0 }, scheduled: [] },
  ])(
    "기능 사용 여부가 $isEnabled이면 마감 거절은 하고 재시도 작업은 $scheduled만 만든다",
    async ({ isEnabled, expected, scheduled: expectedScheduled }) => {
      // Given
      const { maintenance, scheduled } = createMaintenance(isEnabled);

      // When
      const result = await maintenance.execute({
        now: new Date("2028-03-01T00:00:00.000Z"),
        runDate: "2028-03-01",
      });

      // Then
      expect(result).toEqual(expected);
      expect(scheduled).toEqual(expectedScheduled);
    },
  );
});
