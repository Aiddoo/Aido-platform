import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import {
  RETENTION_JOB_POLICY,
  RETENTION_QUEUE,
  RETENTION_STAGE_SWEEP_SCHEDULE,
  RETIRED_RETENTION_OUTBOX_RELAY_SCHEDULE_KEY,
  RetentionJobName,
} from "./retention-queue.constants.js";

@Injectable()
export class RetentionQueueService implements OnModuleInit {
  readonly #logger = new Logger(RetentionQueueService.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Retention scheduler registration",
      async () => {
        await this.runtime.schedule(
          RETENTION_STAGE_SWEEP_SCHEDULE.key,
          RETENTION_STAGE_SWEEP_SCHEDULE.cron,
          RETENTION_QUEUE,
          { name: RetentionJobName.STAGE_SWEEP, data: {} },
          RETENTION_JOB_POLICY,
        );
        await this.runtime.unschedule(RETIRED_RETENTION_OUTBOX_RELAY_SCHEDULE_KEY, RETENTION_QUEUE);
      },
    );
  }
}
