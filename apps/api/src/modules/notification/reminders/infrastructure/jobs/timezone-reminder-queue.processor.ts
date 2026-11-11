import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { match } from "ts-pattern";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationProviderLogEvent } from "../../../push/infrastructure/adapters/notification-provider.log-events.js";
import { SweepTimezoneRemindersUseCase } from "../../application/use-cases/sweep-timezone-reminders.use-case.js";
import {
  TIMEZONE_REMINDER_QUEUE,
  TimezoneReminderJobName,
  type TimezoneReminderRuntimeJob,
} from "./timezone-reminder.queue.js";

@Injectable()
export class TimezoneReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TimezoneReminderQueueProcessor.name);

  readonly #sweep: Pick<
    SweepTimezoneRemindersUseCase,
    "handleMinuteSweep" | "handleReminderHourChanged" | "handleSocialDigest"
  >;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(SweepTimezoneRemindersUseCase)
    sweep: Pick<
      SweepTimezoneRemindersUseCase,
      "handleMinuteSweep" | "handleReminderHourChanged" | "handleSocialDigest"
    >,
    jobQueue: JobQueuePort,
  ) {
    this.#sweep = sweep;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TIMEZONE_REMINDER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
  }

  async process(job: TimezoneReminderRuntimeJob): Promise<void> {
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, jobName: job.name });
    await match(job)
      .with({ name: TimezoneReminderJobName.SWEEP_REMINDERS }, () =>
        this.#sweep.handleMinuteSweep(),
      )
      .with({ name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED }, ({ data }) =>
        this.#sweep.handleReminderHourChanged(data),
      )
      .with({ name: TimezoneReminderJobName.SOCIAL_DIGEST }, ({ data }) =>
        this.#sweep.handleSocialDigest(data),
      )
      .exhaustive();
  }
}
