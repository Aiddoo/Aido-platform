import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { STORE_SUBSCRIPTION_RECONCILE_QUEUE } from "./store-subscription-reconcile.queue.js";
import { StoreSubscriptionReconcileScheduler } from "./store-subscription-reconcile.scheduler.js";

const ENABLED = {
  revenuecat: {
    projectId: "proj_test",
    apiV2SecretKey: "sk_test",
  },
};

describe("StoreSubscriptionReconcileScheduler — 웹훅 뒤 대조 예약", () => {
  it("같은 1분 구간의 예약은 사용자당 한 잡으로 묶고 구간이 끝난 뒤 시작한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new StoreSubscriptionReconcileScheduler(jobQueue, ENABLED);

    // When
    await scheduler.schedule("user-1", Temporal.Instant.from("2027-01-04T12:00:10.500Z"));
    await scheduler.schedule("user-1", Temporal.Instant.from("2027-01-04T12:00:59.999Z"));
    await scheduler.schedule("user-1", Temporal.Instant.from("2027-01-04T12:01:00.000Z"));

    // Then
    expect(
      jobQueue
        .jobsIn(STORE_SUBSCRIPTION_RECONCILE_QUEUE)
        .map(({ options }) => [options.idempotencyKey, options.startAfter]),
    ).toEqual([
      [
        `store-subscription-reconcile_user-1_${Date.parse("2027-01-04T12:00:00.000Z")}`,
        Temporal.Instant.from("2027-01-04T12:01:00.000Z"),
      ],
      [
        `store-subscription-reconcile_user-1_${Date.parse("2027-01-04T12:01:00.000Z")}`,
        Temporal.Instant.from("2027-01-04T12:02:00.000Z"),
      ],
    ]);
  });

  it("예약한 잡의 payload는 사용자 ID를 옛 모양 그대로 싣는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new StoreSubscriptionReconcileScheduler(jobQueue, ENABLED);

    // When
    await scheduler.schedule("user-1", Temporal.Instant.from("2027-01-04T12:00:10.500Z"));

    // Then
    expect(jobQueue.jobsIn(STORE_SUBSCRIPTION_RECONCILE_QUEUE).map((job) => job.payload)).toEqual([
      { name: "reconcile-store-subscriptions", data: { userId: "user-1" } },
    ]);
  });

  it("RevenueCat 읽기 설정이 없으면 잡을 넣지 않는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new StoreSubscriptionReconcileScheduler(jobQueue, {
      revenuecat: { ...ENABLED.revenuecat, apiV2SecretKey: undefined },
    });

    // When
    await scheduler.schedule("user-1", Temporal.Instant.from("2027-01-04T12:00:10.500Z"));

    // Then
    expect(jobQueue.jobs).toEqual([]);
  });
});
