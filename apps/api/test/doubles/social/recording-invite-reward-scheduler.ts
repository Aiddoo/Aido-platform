import {
  type InviteRewardTrigger,
  InviteRewardSchedulerPort,
} from "#api/modules/social/invite-redemptions/application/ports/invite-reward-scheduler.port";
import type { InviteRedemptionId } from "#api/modules/social/invite-redemptions/domain/invite-redemption-id.vo";

export interface ScheduledInviteReward {
  readonly redemptionId: string;
  readonly trigger: InviteRewardTrigger;
}

export class RecordingInviteRewardScheduler extends InviteRewardSchedulerPort {
  readonly scheduled: ScheduledInviteReward[] = [];

  async schedule(redemptionId: InviteRedemptionId, trigger: InviteRewardTrigger): Promise<void> {
    this.scheduled.push({ redemptionId: redemptionId.value, trigger });
  }

  async scheduleMany(
    redemptionIds: readonly InviteRedemptionId[],
    trigger: InviteRewardTrigger,
  ): Promise<void> {
    for (const redemptionId of redemptionIds) {
      await this.schedule(redemptionId, trigger);
    }
  }
}
