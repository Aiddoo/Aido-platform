import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import { PREMIUM_GRANT_SWEEP_QUEUE } from "./premium-grant-sweep.queue.js";

@Injectable()
export class PremiumGrantSweepScheduler implements OnModuleInit {
  readonly #logger = new Logger(PremiumGrantSweepScheduler.name);
  readonly #jobQueue: JobQueuePort;
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // 10분 주기라 놓친 실행은 다음 주기가 이어 받으므로 별도 보정 실행은 두지 않는다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Premium grant sweep scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(PREMIUM_GRANT_SWEEP_QUEUE);
        this.#logger.log({ event: SubscriptionLogEvent.PREMIUM_GRANT_SWEEP_SCHEDULER_REGISTERED });
      },
    );
  }
}
