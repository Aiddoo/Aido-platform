import { Injectable, Logger } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationProviderLogEvent } from "../../../push/infrastructure/adapters/notification-provider.log-events.js";
import {
  type ReminderHourChangedJobData,
  type TargetedSocialDigestJobData,
  TimezoneReminderEnqueuerPort,
} from "../../application/ports/timezone-reminder-enqueuer.port.js";
import { SOCIAL_DIGEST_DELAY_MS } from "../../domain/notification-campaign.constants.js";
import {
  TIMEZONE_REMINDER_QUEUE,
  TimezoneReminderJobName,
  type TimezoneReminderRuntimeJob,
} from "./timezone-reminder.queue.js";

@Injectable()
export class TimezoneReminderQueueAdapter extends TimezoneReminderEnqueuerPort {
  readonly #logger = new Logger(TimezoneReminderQueueAdapter.name);
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    super();
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  enqueueReminderHourChanged(payload: ReminderHourChangedJobData): void {
    this.#enqueueInBackground({
      name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
      data: payload,
    });
  }

  enqueueSocialDigest(payload: TargetedSocialDigestJobData): void {
    this.#enqueueInBackground(
      {
        name: TimezoneReminderJobName.SOCIAL_DIGEST,
        data: { timezone: payload.timezone, recipientUserIds: [...payload.recipientUserIds] },
      },
      this.#clock.now().add({ milliseconds: SOCIAL_DIGEST_DELAY_MS }),
    );
  }

  #enqueueInBackground(job: TimezoneReminderRuntimeJob, startAfter?: Temporal.Instant): void {
    this.#jobQueue
      .enqueue(TIMEZONE_REMINDER_QUEUE, job, startAfter == null ? {} : { startAfter })
      .then(() => {
        this.#logger.debug({ event: NotificationProviderLogEvent.JOB_ENQUEUED, jobName: job.name });
      })
      .catch(() => {
        this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
      });
  }
}
