import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";

import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import { NotifyEndingPremiumGrants } from "../../../application/use-cases/subscriptions/notify-ending-premium-grants.use-case.js";
import { NotifyEndingTrials } from "../../../application/use-cases/subscriptions/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewals } from "../../../application/use-cases/subscriptions/notify-upcoming-renewals.use-case.js";
import { SweepPremiumGrants } from "../../../application/use-cases/subscriptions/sweep-premium-grants.use-case.js";
import {
  PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
  PREMIUM_GRANT_SWEEP_QUEUE,
} from "./premium-grant-sweep-queue.constants.js";

type SweepStep = Pick<NotifyEndingPremiumGrants, "execute">;

@Injectable()
export class PremiumGrantSweepProcessor implements OnModuleInit {
  readonly #logger = new Logger(PremiumGrantSweepProcessor.name);

  constructor(
    @Inject(SweepPremiumGrants)
    private readonly sweepPremiumGrants: Pick<SweepPremiumGrants, "execute">,
    @Inject(NotifyEndingPremiumGrants)
    private readonly notifyEndingPremiumGrants: SweepStep,
    @Inject(NotifyEndingTrials)
    private readonly notifyEndingTrials: SweepStep,
    @Inject(NotifyUpcomingRenewals)
    private readonly notifyUpcomingRenewals: SweepStep,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(PREMIUM_GRANT_SWEEP_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
      queuePolicy: PREMIUM_GRANT_SWEEP_JOB_OPTIONS,
    });
  }

  async process(): Promise<void> {
    const at = now();
    try {
      // 끝난 기간을 먼저 닫아야 안내 대상이 마지막 기간만 남는다
      await this.sweepPremiumGrants.execute({ now: at });
    } catch (error) {
      this.#logger.error({
        event: BillingLogEvent.PREMIUM_GRANT_SWEEP_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }

    // 잡 이름·payload는 그대로 두고 같은 10분 주기에 안내 단계를 붙인다. 각 단계는 조건부 claim이라 재실행에
    // 멱등이므로, 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝내 pg-boss 재시도에 맡긴다
    const steps = [
      { step: "premium-grant-ending", useCase: this.notifyEndingPremiumGrants },
      { step: "trial-ending", useCase: this.notifyEndingTrials },
      { step: "renewal-upcoming", useCase: this.notifyUpcomingRenewals },
    ] as const;
    const failures: unknown[] = [];
    for (const { step, useCase } of steps) {
      try {
        await useCase.execute({ now: at });
      } catch (error) {
        this.#logger.error({
          event: BillingLogEvent.PREMIUM_GRANT_SWEEP_STEP_FAILED,
          step,
          errorType: toErrorType(error),
        });
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(failures, "premium-grant-sweep notice steps failed");
    }
  }
}
