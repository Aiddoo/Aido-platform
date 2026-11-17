import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { match } from "ts-pattern";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationJobLogEvent } from "../../../shared/application/notification-job.log-events.js";
import { CatchUpChangedReminderHourUseCase } from "../../application/use-cases/catch-up-changed-reminder-hour.use-case.js";
import { DeliverQueuedSocialDigestUseCase } from "../../application/use-cases/deliver-queued-social-digest.use-case.js";
import { SweepTimezoneRemindersUseCase } from "../../application/use-cases/sweep-timezone-reminders.use-case.js";
import {
  TIMEZONE_REMINDER_QUEUE,
  TimezoneReminderJobName,
  type TimezoneReminderRuntimeJob,
} from "./timezone-reminder.queue.js";

@Injectable()
export class TimezoneReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TimezoneReminderQueueProcessor.name);

  readonly #sweep: Pick<SweepTimezoneRemindersUseCase, "execute">;
  readonly #catchUpReminderHour: Pick<CatchUpChangedReminderHourUseCase, "execute">;
  readonly #queuedSocialDigest: Pick<DeliverQueuedSocialDigestUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(SweepTimezoneRemindersUseCase)
    sweep: Pick<SweepTimezoneRemindersUseCase, "execute">,
    @Inject(CatchUpChangedReminderHourUseCase)
    catchUpReminderHour: Pick<CatchUpChangedReminderHourUseCase, "execute">,
    @Inject(DeliverQueuedSocialDigestUseCase)
    queuedSocialDigest: Pick<DeliverQueuedSocialDigestUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#sweep = sweep;
    this.#catchUpReminderHour = catchUpReminderHour;
    this.#queuedSocialDigest = queuedSocialDigest;
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
    this.#logger.debug({ event: NotificationJobLogEvent.JOB_STARTED, jobName: job.name });
    await match(job)
      .with({ name: TimezoneReminderJobName.SWEEP_REMINDERS }, () => this.#sweep.execute())
      .with({ name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED }, ({ data }) =>
        this.#catchUpReminderHour.execute(data),
      )
      .with({ name: TimezoneReminderJobName.SOCIAL_DIGEST }, ({ data }) =>
        this.#queuedSocialDigest.execute(data),
      )
      .exhaustive();
  }
}
