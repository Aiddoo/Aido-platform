import {
  nextInviteMilestone,
  premiumCapState,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
  summarizeInviterRewards,
} from "../../domain/invite-reward.domain-service.js";
import type { Invite } from "../../domain/invite.aggregate.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";
import type { MyInvite } from "../read-models/my-invite.read-model.js";

export interface SummarizeMyInviteCommand {
  readonly invite: Invite;
  readonly now: Temporal.Instant;
}

export interface SummarizeMyInviteDependencies {
  readonly inviteRedemptionRepository: Pick<InviteRedemptionRepositoryPort, "summarizeByInviterId">;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "summarizeInviterRewards">;
}

/** 조회와 재발급이 같은 요약을 반환하도록 초대 수와 관계없이 정해진 집계 문장 수로 화면 모델을 만든다. */
export class SummarizeMyInviteUseCase {
  readonly #dependencies: SummarizeMyInviteDependencies;

  constructor(dependencies: SummarizeMyInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SummarizeMyInviteCommand): Promise<MyInvite> {
    const { invite, now } = command;
    const [summary, rewardTotals] = await Promise.all([
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(invite.inviterId),
      this.#dependencies.rewardGrantRepository.summarizeInviterRewards(
        invite.inviterId,
        rewardCapWindowStart(now),
      ),
    ]);

    const qualifiedCount = qualifiedRedemptionCount(summary);
    const rewards = summarizeInviterRewards(rewardTotals);
    return {
      code: invite.code.value,
      waitingCount: summary.joinedCount,
      qualifiedCount,
      premiumDaysInWindow: rewards.premiumDaysInWindow,
      totalPremiumDays: rewards.totalPremiumDays,
      premiumCapState: premiumCapState(rewards),
      nextMilestone: nextInviteMilestone(qualifiedCount),
      rewardsEarned: rewards.rewardsEarned,
      createdAt: invite.createdAt,
    };
  }
}
