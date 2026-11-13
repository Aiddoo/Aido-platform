import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryInviteRedemptionReader } from "#test/doubles/social/in-memory-invite-redemption.reader";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";
import { createInviteRedemptionFixture } from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  inviteFixtureInviteeId,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

import { SummarizeInviterProgressUseCase } from "./summarize-inviter-progress.use-case.js";

const NOW = INVITE_FIXTURE_NOW.add({ hours: 1 });

describe("SummarizeInviterProgressUseCase — 초대한 사람의 인원·보상 진행", () => {
  it("대기·사용 시작 인원을 세고 적용된 보상만 받은 보상으로 센다", async () => {
    // Given
    const redemptions = new InMemoryInviteRedemptionRepository();
    const grants = new InMemoryRewardGrantRepository();
    for (const [index, status] of (["JOINED", "QUALIFIED", "REWARDED"] as const).entries()) {
      await redemptions.save(
        createInviteRedemptionFixture({
          id: `c0000000000000000000rdm0${index}`,
          inviteeId: inviteFixtureInviteeId(index),
          status,
        }),
      );
    }
    await grants.addPending([
      createRewardGrantFixture({ status: "APPLIED", createdAt: NOW }),
      createRewardGrantFixture({
        id: "c0000000000000000000grt02",
        rewardType: "FRIEND_SLOT",
        quantity: 1,
        createdAt: NOW,
      }),
    ]);
    const useCase = new SummarizeInviterProgressUseCase({
      inviteRedemptionReader: new InMemoryInviteRedemptionReader(redemptions, grants),
    });

    // When
    const progress = await useCase.execute({
      inviterId: UserId.reconstitute(INVITE_FIXTURE_INVITER_ID),
      now: NOW,
    });

    // Then
    expect(progress).toMatchObject({
      waitingCount: 1,
      qualifiedCount: 2,
      premiumDaysInWindow: 7,
      totalPremiumDays: 7,
      rewardsEarned: [{ rewardType: "PREMIUM_DAYS", quantity: 7 }],
      nextMilestone: { qualifiedCount: 3 },
    });
  });
});
