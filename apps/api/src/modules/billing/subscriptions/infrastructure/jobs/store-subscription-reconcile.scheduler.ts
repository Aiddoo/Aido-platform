import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StoreSubscriptionReconcileSchedulerPort } from "../../application/ports/store-subscription-reconcile-scheduler.port.js";
import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import {
  type BillingSubscriptionsConfig,
  billingSubscriptionsConfig,
} from "../../billing-subscriptions.config.js";
import {
  reconcileWindowStart,
  STORE_SUBSCRIPTION_RECONCILE_JOB_NAME,
  STORE_SUBSCRIPTION_RECONCILE_QUEUE,
  STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS,
  storeSubscriptionReconcileIdempotencyKey,
} from "./store-subscription-reconcile.queue.js";

/** RevenueCat 읽기 설정이 없으면 대조를 예약하지 않고 기존 웹훅 처리만 한다. */
@Injectable()
export class StoreSubscriptionReconcileScheduler
  implements StoreSubscriptionReconcileSchedulerPort, OnModuleInit
{
  readonly #logger = new Logger(StoreSubscriptionReconcileScheduler.name);
  readonly #jobQueue: JobQueuePort;
  readonly #config: Pick<BillingSubscriptionsConfig, "revenuecat">;

  constructor(
    jobQueue: JobQueuePort,
    @Inject(billingSubscriptionsConfig.KEY) config: Pick<BillingSubscriptionsConfig, "revenuecat">,
  ) {
    this.#jobQueue = jobQueue;
    this.#config = config;
  }

  onModuleInit(): void {
    if (!this.#isEnabled()) {
      this.#logger.log({ event: SubscriptionLogEvent.RECONCILE_DISABLED });
    }
  }

  async schedule(userId: UserId, at: Temporal.Instant): Promise<void> {
    if (!this.#isEnabled()) {
      return;
    }
    await this.#jobQueue.enqueue(
      STORE_SUBSCRIPTION_RECONCILE_QUEUE,
      { name: STORE_SUBSCRIPTION_RECONCILE_JOB_NAME, data: { userId: userId.value } },
      {
        idempotencyKey: storeSubscriptionReconcileIdempotencyKey(userId.value, at),
        startAfter: reconcileWindowStart(at).add({
          milliseconds: STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS,
        }),
      },
    );
  }

  #isEnabled(): boolean {
    const { apiV2SecretKey, projectId } = this.#config.revenuecat;
    return apiV2SecretKey != null && projectId != null;
  }
}
