import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

export const STORE_SUBSCRIPTION_RECONCILE_JOB_NAME = "reconcile-store-subscriptions";

/**
 * 이 구간의 웹훅을 사용자당 대조 한 번으로 묶는다. 구간이 끝난 뒤 시작해 구간 안의 어떤 웹훅도 놓치지 않고,
 * RevenueCat이 같은 변경을 반영할 시간을 준다. 실행 중에 온 웹훅은 다음 구간의 새 작업이 된다.
 */
export const STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS = 60_000;

// 배포 순간 쌓여 있는 작업이 옛 모양({ name, data })이라 그대로 받는다
const storeSubscriptionReconcilePayloadSchema = z.object({
  name: z.literal(STORE_SUBSCRIPTION_RECONCILE_JOB_NAME),
  data: z.object({ userId: z.string().min(1) }),
});

export type StoreSubscriptionReconcilePayload = z.infer<
  typeof storeSubscriptionReconcilePayloadSchema
>;

export const STORE_SUBSCRIPTION_RECONCILE_QUEUE = defineQueue({
  name: "store-subscription-reconcile.v1",
  payloadSchema: storeSubscriptionReconcilePayloadSchema,
  retry: {
    retryLimit: 3,
    retryDelaySeconds: 60,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});

export function reconcileWindowStart(at: Temporal.Instant): Temporal.Instant {
  const epochMs = at.epochMilliseconds;
  return Temporal.Instant.fromEpochMilliseconds(
    epochMs - (epochMs % STORE_SUBSCRIPTION_RECONCILE_WINDOW_MS),
  );
}

// 키 문자열은 쌓여 있는 작업과 같아야 같은 구간의 작업이 한 번만 남는다
export function storeSubscriptionReconcileIdempotencyKey(
  userId: string,
  at: Temporal.Instant,
): string {
  return `store-subscription-reconcile_${userId}_${reconcileWindowStart(at).epochMilliseconds}`;
}
