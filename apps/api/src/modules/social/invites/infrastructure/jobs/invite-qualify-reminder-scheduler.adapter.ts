import { Injectable } from "@nestjs/common";

import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import {
  InviteQualifyReminderSchedulerPort,
  type ScheduledQualifyReminder,
} from "../../application/ports/invite-qualify-reminder-scheduler.port.js";
import {
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
  InviteQualifyReminderJobKey,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteQualifyReminderSchedulerAdapter extends InviteQualifyReminderSchedulerPort {
  readonly #runtime: Pick<JobRuntimePort, "enqueueMany">;

  constructor(runtime: JobRuntimePort) {
    super();
    this.#runtime = runtime;
  }

  async scheduleMany(reminders: readonly ScheduledQualifyReminder[]): Promise<void> {
    if (reminders.length === 0) {
      return;
    }
    await this.#runtime.enqueueMany(
      INVITE_MAINTENANCE_QUEUE,
      reminders.map(({ redemptionId, sendAt }) => ({
        data: {
          name: INVITE_QUALIFY_REMINDER_JOB_NAME,
          data: { redemptionId: redemptionId.value },
        },
        options: {
          ...INVITE_MAINTENANCE_JOB_OPTIONS,
          startAfter: instantToDate(sendAt),
          idempotencyKey: InviteQualifyReminderJobKey.of(redemptionId, sendAt),
        },
      })),
    );
  }
}
