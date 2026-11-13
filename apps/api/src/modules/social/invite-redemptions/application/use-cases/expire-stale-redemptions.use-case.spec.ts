import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { RecordingInviteRewardScheduler } from "#test/doubles/social/recording-invite-reward-scheduler";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import { inviteFixtureInviteeId } from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

import {
  type ExpireStaleRedemptionsDependencies,
  ExpireStaleRedemptionsUseCase,
} from "./expire-stale-redemptions.use-case.js";

const NOW = Temporal.Instant.from("2028-03-20T00:00:00Z");
const RUN_DATE = Temporal.PlainDate.from("2028-03-20");

function createExpireStaleRedemptionsUseCase(
  overrides: Partial<ExpireStaleRedemptionsDependencies> = {},
) {
  return new ExpireStaleRedemptionsUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    inviteRedemptionRepository: new InMemoryInviteRedemptionRepository(),
    rewardGrantRepository: new InMemoryRewardGrantRepository(),
    rewardScheduler: new RecordingInviteRewardScheduler(),
    inviteConfig: { isEnabled: true },
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("ExpireStaleRedemptionsUseCase — 초대 정비", () => {
  it.each([
    { isEnabled: true, expectedRetried: ["c0000000000000000000rdm0a"] },
    { isEnabled: false, expectedRetried: [] },
  ])(
    "기능 사용 여부가 $isEnabled이면 마감 거절은 하고 재시도 작업은 $expectedRetried만 실행 날짜 키로 만든다",
    async ({ isEnabled, expectedRetried }) => {
      // Given
      const inviteRedemptionRepository = new InMemoryInviteRedemptionRepository([
        createInviteRedemptionFixture({
          id: "c0000000000000000000rdm01",
          inviteeId: inviteFixtureInviteeId(0),
          expiresAt: NOW.subtract({ hours: 1 }),
        }),
        createInviteRedemptionFixture({
          id: "c0000000000000000000rdm02",
          inviteeId: inviteFixtureInviteeId(1),
          expiresAt: NOW.add({ hours: 1 }),
        }),
      ]);
      const rewardGrantRepository = new InMemoryRewardGrantRepository([
        createRewardGrantFixture({
          sourceId: "c0000000000000000000rdm0a",
          createdAt: NOW.subtract({ minutes: 10 }),
        }),
        // 방금 만든 지급은 첫 작업이 아직 처리 중일 수 있어 빼야 한다
        createRewardGrantFixture({
          id: "c0000000000000000000grt02",
          sourceId: "c0000000000000000000rdm0b",
          createdAt: NOW.subtract({ minutes: 9 }),
        }),
      ]);
      const rewardScheduler = new RecordingInviteRewardScheduler();
      const useCase = createExpireStaleRedemptionsUseCase({
        inviteRedemptionRepository,
        rewardGrantRepository,
        rewardScheduler,
        inviteConfig: { isEnabled },
      });

      // When
      const result = await useCase.execute({ now: NOW, runDate: RUN_DATE });

      // Then
      expect(result).toEqual({ expiredCount: 1, retriedCount: expectedRetried.length });
      expect(rewardScheduler.scheduled).toEqual(
        expectedRetried.map((redemptionId) => ({
          redemptionId,
          trigger: { kind: "retry", runDate: RUN_DATE },
        })),
      );
    },
  );
});
