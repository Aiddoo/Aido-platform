import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  InviteQualifyReminderSchedulerPort,
  type ScheduledQualifyReminder,
} from "../../application/ports/invite-qualify-reminder-scheduler.port.js";
import {
  INVITE_MAINTENANCE_QUEUE,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
  InviteQualifyReminderJobKey,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteQualifyReminderSchedulerAdapter extends InviteQualifyReminderSchedulerPort {
  readonly #jobQueue: Pick<JobQueuePort, "enqueueMany">;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void> {
    if (reminders.length === 0) {
      return;
    }
    await this.#jobQueue.enqueueMany(
      INVITE_MAINTENANCE_QUEUE,
      reminders.map(({ redemptionId, sendAt }) => ({
        payload: {
          name: INVITE_QUALIFY_REMINDER_JOB_NAME,
          data: { redemptionId: redemptionId.value },
        },
        startAfter: sendAt,
        idempotencyKey: InviteQualifyReminderJobKey.of(redemptionId, sendAt),
      })),
    );
  }
}
