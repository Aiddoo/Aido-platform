import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { RETENTION_QUEUE } from "./retention.queue.js";

@Injectable()
export class RetentionStageSweepScheduler implements OnModuleInit {
  readonly #logger = new Logger(RetentionStageSweepScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Retention scheduler registration",
      () => this.#jobQueue.registerSchedules(RETENTION_QUEUE),
    );
  }
}
