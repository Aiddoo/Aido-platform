import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  nextInviteMilestone,
  premiumCapState,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
  summarizeInviterRewards,
} from "../../domain/invite-reward.domain-service.js";
import type { InviteRedemptionReaderPort } from "../ports/invite-redemption.reader.port.js";
import type { InviterProgressReadModel } from "../read-models/inviter-progress.read-model.js";

export interface SummarizeInviterProgressQuery {
  readonly inviterId: UserId;
  readonly now: Temporal.Instant;
}

export interface SummarizeInviterProgressDependencies {
  readonly inviteRedemptionReader: Pick<
    InviteRedemptionReaderPort,
    "summarizeByInviterId" | "summarizeInviterRewards"
  >;
}

// 조회와 재발급이 같은 요약을 반환하도록 초대 수와 관계없이 정해진 집계 문장 수로 만든다
export class SummarizeInviterProgressUseCase {
  readonly #dependencies: SummarizeInviterProgressDependencies;

  constructor(dependencies: SummarizeInviterProgressDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: SummarizeInviterProgressQuery): Promise<InviterProgressReadModel> {
    const { inviteRedemptionReader } = this.#dependencies;
    const [summary, rewardTotals] = await Promise.all([
      inviteRedemptionReader.summarizeByInviterId(query.inviterId),
      inviteRedemptionReader.summarizeInviterRewards(
        query.inviterId,
        rewardCapWindowStart(query.now),
      ),
    ]);

    const qualifiedCount = qualifiedRedemptionCount(summary);
    const rewards = summarizeInviterRewards(rewardTotals);
    return {
      waitingCount: summary.joinedCount,
      qualifiedCount,
      premiumDaysInWindow: rewards.premiumDaysInWindow,
      totalPremiumDays: rewards.totalPremiumDays,
      premiumCapState: premiumCapState(rewards),
      nextMilestone: nextInviteMilestone(qualifiedCount),
      rewardsEarned: rewards.rewardsEarned,
    };
  }
}
