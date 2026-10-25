import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { now } from "#api/shared/domain/date/utils/core";

import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import { NotifyEndingPremiumGrants } from "../../../application/use-cases/subscriptions/notify-ending-premium-grants.use-case.js";
import { SweepPremiumGrants } from "../../../application/use-cases/subscriptions/sweep-premium-grants.use-case.js";
import {
  PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
  PREMIUM_GRANT_SWEEP_QUEUE,
  type PremiumGrantSweepJobData,
} from "./premium-grant-sweep-queue.constants.js";

@Injectable()
export class PremiumGrantSweepProcessor implements OnModuleInit {
  readonly #logger = new Logger(PremiumGrantSweepProcessor.name);

  constructor(
    @Inject(SweepPremiumGrants)
    private readonly sweepPremiumGrants: Pick<SweepPremiumGrants, "execute">,
    @Inject(NotifyEndingPremiumGrants)
    private readonly notifyEndingPremiumGrants: Pick<NotifyEndingPremiumGrants, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work<PremiumGrantSweepJobData>(
      PREMIUM_GRANT_SWEEP_QUEUE,
      async () => this.process(),
      {
        teamSize: 1,
        pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
        queuePolicy: PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
      },
    );
  }

  async process(): Promise<void> {
    const at = now();
    try {
      // 끝난 기간을 먼저 닫아야 안내 대상이 마지막 기간만 남는다
      await this.sweepPremiumGrants.execute({ now: at });
      await this.notifyEndingPremiumGrants.execute({ now: at });
    } catch (error) {
      this.#logger.error({
        event: BillingLogEvent.PREMIUM_GRANT_SWEEP_JOB_FAILED,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      throw error;
    }
  }
}
