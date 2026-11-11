import {
  InviteQualifyReminderSchedulerPort,
  type ScheduledQualifyReminder,
} from "#api/modules/social/invites/application/ports/invite-qualify-reminder-scheduler.port";

export class RecordingInviteQualifyReminderScheduler extends InviteQualifyReminderSchedulerPort {
  readonly scheduled: { readonly redemptionId: string; readonly sendAt: Temporal.Instant }[] = [];

  async scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void> {
    for (const { redemptionId, sendAt } of reminders) {
      this.scheduled.push({ redemptionId: redemptionId.value, sendAt });
    }
  }
}
