import { inviteUserNotFound } from "#api/modules/social/invites/application/invites.errors";
import { RewardApplierPort } from "#api/modules/social/invites/application/ports/reward-applier.port";
import type { RewardGrant } from "#api/modules/social/invites/domain/reward-grant.entity";

// 적용한 지급을 남긴다. 운영 어댑터처럼 받는 사람이 없으면 USER_0601, failing이면 공급자 장애처럼 던진다
export class RecordingRewardApplier extends RewardApplierPort {
  readonly applied: RewardGrant[] = [];
  readonly missingUserIds = new Set<string>();
  failing: (grant: RewardGrant) => boolean = () => false;

  async apply(grant: RewardGrant): Promise<void> {
    if (this.missingUserIds.has(grant.recipientId.value)) {
      throw inviteUserNotFound(grant.recipientId);
    }
    if (this.failing(grant)) {
      throw new Error("billing unavailable");
    }
    this.applied.push(grant);
  }
}
