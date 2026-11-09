import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import type { StoreSubscriptionReconcileSchedulerPort } from "../../../application/ports/subscriptions/store-subscription-reconcile.scheduler.port.js";
import {
  reconcileWindowStart,
  STORE_SUBSCRIPTION_RECONCILE_JOB_NAME,
  STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
  STORE_SUBSCRIPTION_RECONCILE_QUEUE,
  STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS,
  storeSubscriptionReconcileIdempotencyKey,
} from "./store-subscription-reconcile-queue.constants.js";

/** RevenueCat 읽기 설정이 없으면 대조를 예약하지 않고 기존 웹훅 처리만 한다. */
@Injectable()
export class StoreSubscriptionReconcileScheduler
  implements StoreSubscriptionReconcileSchedulerPort, OnModuleInit
{
  readonly #logger = new Logger(StoreSubscriptionReconcileScheduler.name);

  constructor(
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    @Inject(TypedConfigService)
    private readonly config: Pick<TypedConfigService, "revenuecat">,
  ) {}

  onModuleInit(): void {
    if (!this.#isEnabled()) {
      this.#logger.log({ event: BillingLogEvent.RECONCILE_DISABLED });
    }
  }

  async schedule(userId: string, at: Date): Promise<void> {
    if (!this.#isEnabled()) {
      return;
    }
    await this.runtime.enqueue(
      STORE_SUBSCRIPTION_RECONCILE_QUEUE,
      { name: STORE_SUBSCRIPTION_RECONCILE_JOB_NAME, data: { userId } },
      {
        ...STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
        idempotencyKey: storeSubscriptionReconcileIdempotencyKey(userId, at),
        startAfter: new Date(reconcileWindowStart(at) + STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS),
      },
    );
  }

  #isEnabled(): boolean {
    const { apiV2SecretKey, projectId } = this.config.revenuecat;
    return apiV2SecretKey != null && projectId != null;
  }
}
