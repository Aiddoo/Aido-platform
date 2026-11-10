export interface ScheduledQualifyReminder {
  readonly redemptionId: string;
  /** 초대받은 사람 시간대의 발송 시각 */
  readonly sendAt: Date;
}

export const INVITE_QUALIFY_REMINDER_SCHEDULER = Symbol("INVITE_QUALIFY_REMINDER_SCHEDULER");

export interface InviteQualifyReminderSchedulerPort {
  /** 같은 수락의 같은 발송 시각은 작업 하나로 합친다. 정비 작업을 다시 돌려도 늘지 않는다. */
  scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void>;
}
