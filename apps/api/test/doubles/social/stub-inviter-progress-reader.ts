import {
  InviterProgressReaderPort,
  type InviterProgressReadModel,
} from "#api/modules/social/invite-redemptions/social-invite-redemption-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 초대 수락이 하나도 없는 초대한 사람의 진행이다. 계산 규칙은 수락 slice의 spec이 지킨다
const NO_PROGRESS: InviterProgressReadModel = {
  waitingCount: 0,
  qualifiedCount: 0,
  premiumDaysInWindow: 0,
  totalPremiumDays: 0,
  premiumCapState: "AVAILABLE",
  nextMilestone: {
    qualifiedCount: 1,
    rewards: [
      { rewardType: "PREMIUM_DAYS", quantity: 7 },
      { rewardType: "FRIEND_SLOT", quantity: 1 },
    ],
  },
  rewardsEarned: [],
};

export class StubInviterProgressReader extends InviterProgressReaderPort {
  async readProgress(
    _inviterId: UserId,
    _now: Temporal.Instant,
  ): Promise<InviterProgressReadModel> {
    return NO_PROGRESS;
  }
}
