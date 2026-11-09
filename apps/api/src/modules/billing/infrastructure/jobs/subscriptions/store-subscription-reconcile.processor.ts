import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";

import { BillingAlertKey } from "../../../application/observability/subscriptions/billing-alerts.js";
import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import { ReconcileStoreSubscriptions } from "../../../application/use-cases/subscriptions/reconcile-store-subscriptions.use-case.js";
import {
  STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
  STORE_SUBSCRIPTION_RECONCILE_QUEUE,
  STORE_SUBSCRIPTION_RECONCILE_WORKER_POLICY,
  storeSubscriptionReconcileJobSchema,
} from "./store-subscription-reconcile-queue.constants.js";

@Injectable()
export class StoreSubscriptionReconcileProcessor implements OnModuleInit {
  readonly #logger = new Logger(StoreSubscriptionReconcileProcessor.name);

  constructor(
    @Inject(ReconcileStoreSubscriptions)
    private readonly reconcileStoreSubscriptions: Pick<ReconcileStoreSubscriptions, "execute">,
    @Inject(OPERATIONAL_ALERT) private readonly alert: OperationalAlertPort,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(
      STORE_SUBSCRIPTION_RECONCILE_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data, job.attempt);
        }
      },
      {
        ...STORE_SUBSCRIPTION_RECONCILE_WORKER_POLICY,
        queuePolicy: STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
      },
    );
  }

  // 대조는 스토어 값으로 덮어쓰기라 같은 payload를 다시 돌려도 결과가 같다
  async process(untrustedJob: unknown, attempt: number): Promise<void> {
    const parsed = storeSubscriptionReconcileJobSchema.safeParse(untrustedJob);
    if (!parsed.success) {
      this.#logger.warn({ event: BillingLogEvent.RECONCILE_INVALID });
      return;
    }
    const { userId } = parsed.data.data;
    try {
      await this.reconcileStoreSubscriptions.execute({ userId, now: now() });
    } catch (error) {
      const errorType = toErrorType(error);
      this.#logger.warn({ event: BillingLogEvent.RECONCILE_FAILED, userId, attempt, errorType });
      if (attempt > STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY.retryLimit) {
        // 재시도가 끝났다. 키 권한·만료나 RevenueCat 장애면 모든 사용자의 대조가 멈추므로 사람이 봐야 한다
        this.alert.raise({
          key: BillingAlertKey.RECONCILE_FAILED,
          severity: "error",
          message: "구독 스토어 상태 대조가 재시도 뒤에도 실패했습니다.",
          details: { userId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
