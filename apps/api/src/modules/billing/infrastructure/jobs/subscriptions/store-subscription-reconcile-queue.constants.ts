import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";
import { subtractMilliseconds } from "#api/shared/domain/date/utils/arithmetic";

export const STORE_SUBSCRIPTION_RECONCILE_QUEUE = "store-subscription-reconcile.v1";
export const STORE_SUBSCRIPTION_RECONCILE_JOB_NAME = "reconcile-store-subscriptions";

/**
 * 이 구간의 웹훅을 사용자당 대조 한 번으로 묶는다. 구간이 끝난 뒤 시작해 구간 안의 어떤 웹훅도 놓치지 않고,
 * RevenueCat이 같은 변경을 반영할 시간을 준다. 실행 중에 온 웹훅은 다음 구간의 새 작업이 된다.
 */
export const STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS = 60_000;

export const storeSubscriptionReconcileJobSchema = z.object({
  name: z.literal(STORE_SUBSCRIPTION_RECONCILE_JOB_NAME),
  data: z.object({ userId: z.string().min(1) }),
});

export const STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY = {
  retryLimit: 3,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies EnqueueJobOptions;

export const STORE_SUBSCRIPTION_RECONCILE_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
} as const;

export function storeSubscriptionReconcileIdempotencyKey(userId: string, at: Date): string {
  return `store-subscription-reconcile_${userId}_${reconcileWindowStart(at).getTime()}`;
}

export function reconcileWindowStart(at: Date): Date {
  return subtractMilliseconds(at.getTime() % STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS, at);
}
