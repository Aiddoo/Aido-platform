import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";

import type { StoreSubscriptionReconcileSchedulerPort } from "../../application/ports/store-subscription-reconcile-scheduler.port.js";
import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import {
  reconcileWindowStart,
  STORE_SUBSCRIPTION_RECONCILE_JOB_NAME,
  STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
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

  readonly #runtime: JobRuntimePort;
  readonly #config: Pick<TypedConfigService, "revenuecat">;

  constructor(
    @Inject(JOB_RUNTIME) runtime: JobRuntimePort,
    @Inject(TypedConfigService)
    config: Pick<TypedConfigService, "revenuecat">,
  ) {
    this.#runtime = runtime;
    this.#config = config;
  }

  onModuleInit(): void {
    if (!this.#isEnabled()) {
      this.#logger.log({ event: SubscriptionLogEvent.RECONCILE_DISABLED });
    }
  }

  async schedule(userId: string, at: Date): Promise<void> {
    if (!this.#isEnabled()) {
      return;
    }
    await this.#runtime.enqueue(
      STORE_SUBSCRIPTION_RECONCILE_QUEUE,
      { name: STORE_SUBSCRIPTION_RECONCILE_JOB_NAME, data: { userId } },
      {
        ...STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
        idempotencyKey: storeSubscriptionReconcileIdempotencyKey(userId, at),
        startAfter: addMilliseconds(
          STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS,
          reconcileWindowStart(at),
        ),
      },
    );
  }

  #isEnabled(): boolean {
    const { apiV2SecretKey, projectId } = this.#config.revenuecat;
    return apiV2SecretKey != null && projectId != null;
  }
}
