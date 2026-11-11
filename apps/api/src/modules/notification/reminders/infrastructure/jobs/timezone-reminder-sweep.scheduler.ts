import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationProviderLogEvent } from "../../../push/infrastructure/adapters/notification-provider.log-events.js";
import { TIMEZONE_REMINDER_QUEUE, TimezoneReminderJobName } from "./timezone-reminder.queue.js";

@Injectable()
export class TimezoneReminderSweepScheduler implements OnModuleInit {
  readonly #logger = new Logger(TimezoneReminderSweepScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // 작업 저장소 장애 중에도 부팅은 진행한다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Timezone reminder sweep scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(TIMEZONE_REMINDER_QUEUE);
        this.#logger.log({
          event: NotificationProviderLogEvent.SCHEDULE_REGISTERED,
          jobName: TimezoneReminderJobName.SWEEP_REMINDERS,
        });
      },
    );
  }
}
