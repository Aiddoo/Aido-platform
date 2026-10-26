import type { Invite } from "../../../domain/aggregates/invites/invite.aggregate.js";
import {
  InviteRewardPolicy,
  premiumCapState,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
} from "../../../domain/policies/invites/invite-reward.policy.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { RewardGrantRepositoryPort } from "../../ports/invites/reward-grant.repository.port.js";
import type { MyInviteView } from "../../read-models/invites/my-invite.read-model.js";

interface MyInviteReaderDependencies {
  readonly inviteRedemptionRepository: Pick<InviteRedemptionRepositoryPort, "summarizeByInviterId">;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "summarizeInviterRewards">;
}

/** 조회와 재발급이 같은 요약을 반환하도록 초대 수와 관계없이 정해진 집계 문장 수로 화면 모델을 만든다. */
export class MyInviteReader {
  readonly #dependencies: MyInviteReaderDependencies;

  constructor(dependencies: MyInviteReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async read(invite: Invite, now: Date): Promise<MyInviteView> {
    const [summary, rewardTotals] = await Promise.all([
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(invite.inviterId),
      this.#dependencies.rewardGrantRepository.summarizeInviterRewards(
        invite.inviterId,
        rewardCapWindowStart(now),
      ),
    ]);

    const qualifiedCount = qualifiedRedemptionCount(summary);
    const rewards = InviteRewardPolicy.summarize(rewardTotals);
    return {
      code: invite.code,
      waitingCount: summary.joinedCount,
      qualifiedCount,
      premiumDaysInWindow: rewards.premiumDaysInWindow,
      totalPremiumDays: rewards.totalPremiumDays,
      premiumCapState: premiumCapState(rewards),
      nextMilestone: InviteRewardPolicy.nextMilestone(qualifiedCount),
      rewardsEarned: rewards.rewardsEarned,
      createdAt: invite.createdAt,
    };
  }
}
