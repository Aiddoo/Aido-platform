import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type {
  InviteQualifyReminderSchedulerPort,
  ScheduledQualifyReminder,
} from "../../../application/ports/invites/invite-qualify-reminder.scheduler.port.js";
import {
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
  InviteQualifyReminderJobKey,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteQualifyReminderSchedulerAdapter implements InviteQualifyReminderSchedulerPort {
  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  async scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void> {
    if (reminders.length === 0) return;
    await this.runtime.enqueueMany(
      INVITE_MAINTENANCE_QUEUE,
      reminders.map(({ redemptionId, sendAt }) => ({
        data: { name: INVITE_QUALIFY_REMINDER_JOB_NAME, data: { redemptionId } },
        options: {
          ...INVITE_MAINTENANCE_JOB_OPTIONS,
          startAfter: sendAt,
          idempotencyKey: InviteQualifyReminderJobKey.of(redemptionId, sendAt),
        },
      })),
    );
  }
}
