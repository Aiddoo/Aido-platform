import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { sumBy, uniq } from "es-toolkit";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import type { JobEnvelope } from "#api/shared/application/ports/job-runtime.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { SubscriptionAlerts } from "../../application/subscriptions.alerts.js";
import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import { ReconcileStoreSubscriptionsUseCase } from "../../application/use-cases/reconcile-store-subscriptions.use-case.js";
import type { SubscriptionReconcileField } from "../../domain/subscription.aggregate.js";
import {
  STORE_SUBSCRIPTION_RECONCILE_QUEUE,
  type StoreSubscriptionReconcilePayload,
} from "./store-subscription-reconcile.queue.js";

type ReconcileJobOutcome =
  | {
      readonly kind: "reconciled";
      readonly correctedCount: number;
      readonly fields: readonly SubscriptionReconcileField[];
    }
  | { readonly kind: "failed"; readonly error: unknown };

@Injectable()
export class StoreSubscriptionReconcileProcessor implements OnModuleInit {
  readonly #logger = new Logger(StoreSubscriptionReconcileProcessor.name);
  readonly #reconcileStoreSubscriptions: Pick<ReconcileStoreSubscriptionsUseCase, "execute">;
  readonly #alert: OperationalAlertPort;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(
    reconcileStoreSubscriptions: ReconcileStoreSubscriptionsUseCase,
    alert: OperationalAlertPort,
    jobQueue: JobQueuePort,
    clock: ClockPort,
  ) {
    this.#reconcileStoreSubscriptions = reconcileStoreSubscriptions;
    this.#alert = alert;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(STORE_SUBSCRIPTION_RECONCILE_QUEUE, (jobs) => this.process(jobs));
  }

  // 대조는 스토어 값으로 덮어쓰기라 같은 payload를 다시 돌려도 결과가 같다. 결과는 사용자 없이 요약 한 건으로 남기고,
  // 실패가 있으면 나머지를 끝낸 뒤 던져 pg-boss 재시도에 맡긴다. 형식이 틀린 payload는 큐 어댑터가 그 작업만 실패시킨다
  async process(
    jobs: readonly Pick<JobEnvelope<StoreSubscriptionReconcilePayload>, "data" | "attempt">[],
  ): Promise<void> {
    const outcomes: ReconcileJobOutcome[] = [];
    for (const job of jobs) {
      outcomes.push(await this.#reconcile(job.data.data.userId, job.attempt));
    }
    const reconciled = outcomes.flatMap((outcome) =>
      outcome.kind === "reconciled" ? [outcome] : [],
    );
    const failures = outcomes.flatMap((outcome) => (outcome.kind === "failed" ? [outcome] : []));
    const summary = {
      event: SubscriptionLogEvent.RECONCILE_COMPLETED,
      jobCount: jobs.length,
      correctedUserCount: reconciled.filter((outcome) => outcome.correctedCount > 0).length,
      correctedChainCount: sumBy(reconciled, (outcome) => outcome.correctedCount),
      unchangedCount: reconciled.filter((outcome) => outcome.correctedCount === 0).length,
      fields: uniq(reconciled.flatMap((outcome) => outcome.fields)),
      failedCount: failures.length,
      errorTypes: uniq(failures.map((failure) => toErrorType(failure.error))),
    };
    if (failures.length > 0) {
      this.#logger.warn(summary);
    } else {
      this.#logger.log(summary);
    }
    const [firstFailure] = failures;
    if (firstFailure != null) {
      throw firstFailure.error;
    }
  }

  async #reconcile(userId: string, attempt: number): Promise<ReconcileJobOutcome> {
    try {
      const result = await this.#reconcileStoreSubscriptions.execute({
        userId,
        now: this.#clock.now(),
      });
      return { kind: "reconciled", ...result };
    } catch (error) {
      if (attempt > STORE_SUBSCRIPTION_RECONCILE_QUEUE.retry.retryLimit) {
        // 재시도가 끝났다. 키 권한·만료나 RevenueCat 장애면 모든 사용자의 대조가 멈추므로 사람이 봐야 한다
        this.#alert.raise({
          ...SubscriptionAlerts.RECONCILE_FAILED,
          details: { userId, attempt, errorType: toErrorType(error) },
        });
      }
      return { kind: "failed", error };
    }
  }
}
