import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import {
  PREMIUM_GRANT_SWEEP_JOB_NAME,
  PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
  PREMIUM_GRANT_SWEEP_QUEUE,
  PREMIUM_GRANT_SWEEP_SCHEDULE,
} from "./premium-grant-sweep-queue.constants.js";

@Injectable()
export class PremiumGrantSweepJob implements OnModuleInit {
  readonly #logger = new Logger(PremiumGrantSweepJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  onModuleInit(): void {
    // 10분 주기라 놓친 실행은 다음 주기가 이어 받으므로 별도 보정 실행은 두지 않는다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Premium grant sweep scheduler registration",
      async () => {
        await this.runtime.schedule(
          PREMIUM_GRANT_SWEEP_SCHEDULE.id,
          PREMIUM_GRANT_SWEEP_SCHEDULE.cron,
          PREMIUM_GRANT_SWEEP_QUEUE,
          { name: PREMIUM_GRANT_SWEEP_JOB_NAME, data: {} },
          PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
        );
        this.#logger.log({ event: BillingLogEvent.PREMIUM_GRANT_SWEEP_SCHEDULER_REGISTERED });
      },
    );
  }
}
