import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";

export interface ScheduledQualifyReminder {
  readonly redemptionId: InviteRedemptionId;
  /** 초대받은 사람 시간대의 발송 시각 */
  readonly sendAt: Temporal.Instant;
}

export abstract class InviteQualifyReminderSchedulerPort {
  /** 같은 수락의 같은 발송 시각은 작업 하나로 합친다. 정비 작업을 다시 돌려도 늘지 않는다. */
  abstract scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void>;
}
