import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { QUOTA_ABANDONED_REFUND_QUEUE } from "./quota-abandoned-refund.queue.js";

@Injectable()
export class QuotaAbandonedRefundScheduler implements OnModuleInit {
  readonly #logger = new Logger(QuotaAbandonedRefundScheduler.name);
  readonly #jobQueue: JobQueuePort;
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Quota abandoned refund scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(QUOTA_ABANDONED_REFUND_QUEUE);
      },
    );
  }
}
