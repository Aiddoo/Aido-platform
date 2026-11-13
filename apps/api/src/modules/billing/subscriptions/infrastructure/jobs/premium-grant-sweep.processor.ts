import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import {
  NotifyEndingPremiumGrantsUseCase,
  SweepPremiumGrantsUseCase,
} from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import { NotifyEndingTrialsUseCase } from "../../application/use-cases/notify-ending-trials.use-case.js";
import { NotifyUpcomingRenewalsUseCase } from "../../application/use-cases/notify-upcoming-renewals.use-case.js";
import { PREMIUM_GRANT_SWEEP_QUEUE } from "./premium-grant-sweep.queue.js";

type SweepStep = Pick<NotifyEndingPremiumGrantsUseCase, "execute">;

// 보상 기간 정리 잡이 체험 종료·갱신 예정 안내(subscriptions)까지 같은 10분 주기에 돌리므로 처리기는 subscriptions에 둔다
@Injectable()
export class PremiumGrantSweepProcessor implements OnModuleInit {
  readonly #logger = new Logger(PremiumGrantSweepProcessor.name);
  readonly #sweepPremiumGrants: Pick<SweepPremiumGrantsUseCase, "execute">;
  readonly #notifyEndingPremiumGrants: SweepStep;
  readonly #notifyEndingTrials: SweepStep;
  readonly #notifyUpcomingRenewals: SweepStep;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(
    sweepPremiumGrants: SweepPremiumGrantsUseCase,
    notifyEndingPremiumGrants: NotifyEndingPremiumGrantsUseCase,
    notifyEndingTrials: NotifyEndingTrialsUseCase,
    notifyUpcomingRenewals: NotifyUpcomingRenewalsUseCase,
    jobQueue: JobQueuePort,
    clock: ClockPort,
  ) {
    this.#sweepPremiumGrants = sweepPremiumGrants;
    this.#notifyEndingPremiumGrants = notifyEndingPremiumGrants;
    this.#notifyEndingTrials = notifyEndingTrials;
    this.#notifyUpcomingRenewals = notifyUpcomingRenewals;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(PREMIUM_GRANT_SWEEP_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    const now = this.#clock.now();
    try {
      // 끝난 기간을 먼저 닫아야 안내 대상이 마지막 기간만 남는다
      await this.#sweepPremiumGrants.execute({ now });
    } catch (error) {
      this.#logger.error({
        event: SubscriptionLogEvent.PREMIUM_GRANT_SWEEP_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }

    // 잡 이름·payload는 그대로 두고 같은 10분 주기에 안내 단계를 붙인다. 각 단계는 조건부 claim이라 재실행에
    // 멱등이므로, 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝내 pg-boss 재시도에 맡긴다
    const steps = [
      { step: "premium-grant-ending", useCase: this.#notifyEndingPremiumGrants },
      { step: "trial-ending", useCase: this.#notifyEndingTrials },
      { step: "renewal-upcoming", useCase: this.#notifyUpcomingRenewals },
    ] as const;
    const failures: unknown[] = [];
    for (const { step, useCase } of steps) {
      try {
        await useCase.execute({ now });
      } catch (error) {
        this.#logger.error({
          event: SubscriptionLogEvent.PREMIUM_GRANT_SWEEP_STEP_FAILED,
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
