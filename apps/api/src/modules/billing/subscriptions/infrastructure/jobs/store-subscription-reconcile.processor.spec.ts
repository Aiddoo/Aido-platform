import { Logger } from "@nestjs/common";

import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { SubscriptionLogEvent } from "../../application/subscriptions.log-events.js";
import {
  ReconcileStoreSubscriptionsUseCase,
  type ReconcileStoreSubscriptionsResult,
} from "../../application/use-cases/reconcile-store-subscriptions.use-case.js";
import { StoreSubscriptionReconcileProcessor } from "./store-subscription-reconcile.processor.js";
import {
  STORE_SUBSCRIPTION_RECONCILE_JOB_NAME,
  STORE_SUBSCRIPTION_RECONCILE_QUEUE,
  type StoreSubscriptionReconcilePayload,
} from "./store-subscription-reconcile.queue.js";

const NOW = Temporal.Instant.from("2027-01-04T12:00:00.000Z");

const job = (
  userId: string,
  attempt = 1,
): { readonly data: StoreSubscriptionReconcilePayload; readonly attempt: number } => ({
  data: { name: STORE_SUBSCRIPTION_RECONCILE_JOB_NAME, data: { userId } },
  attempt,
});

// UseCase 의존성은 만들지 않고 execute만 대신하는 인스턴스다
function stubReconcileUseCase(
  results: Readonly<Record<string, ReconcileStoreSubscriptionsResult | Error>>,
  receivedNows: Temporal.Instant[],
): ReconcileStoreSubscriptionsUseCase {
  const useCase: ReconcileStoreSubscriptionsUseCase = Object.create(
    ReconcileStoreSubscriptionsUseCase.prototype,
  );
  vi.spyOn(useCase, "execute").mockImplementation(async ({ userId, now }) => {
    receivedNows.push(now);
    const result = results[userId] ?? new Error("unknown user");
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
  return useCase;
}

function createProcessor(
  results: Readonly<Record<string, ReconcileStoreSubscriptionsResult | Error>>,
) {
  const alert = new RecordingOperationalAlert();
  const receivedNows: Temporal.Instant[] = [];
  const processor = new StoreSubscriptionReconcileProcessor(
    stubReconcileUseCase(results, receivedNows),
    alert,
    new InMemoryJobQueue(),
    new FixedClock(NOW),
  );
  return { processor, alerts: alert.alerts, receivedNows };
}

describe("StoreSubscriptionReconcileProcessor — 대조 잡 요약 로그", () => {
  it("고친 잡과 같은 잡을 사용자 ID 없이 요약 한 건으로 남기고 시계의 지금으로 대조한다", async () => {
    // Given
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const { processor, receivedNows } = createProcessor({
      "user-corrected": { correctedCount: 2, fields: ["expiresAt", "status"] },
      "user-same": { correctedCount: 0, fields: [] },
    });

    // When
    await processor.process([job("user-corrected"), job("user-same")]);

    // Then
    expect(log).toHaveBeenCalledExactlyOnceWith({
      event: SubscriptionLogEvent.RECONCILE_COMPLETED,
      jobCount: 2,
      correctedUserCount: 1,
      correctedChainCount: 2,
      unchangedCount: 1,
      fields: ["expiresAt", "status"],
      failedCount: 0,
      errorTypes: [],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("user-");
    expect(receivedNows).toEqual([NOW, NOW]);
  });

  it("실패는 요약에 세고 던져 재시도에 맡기며, 재시도가 끝났을 때만 경보를 올린다", async () => {
    // Given
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const failure = new Error("store read failed");
    const { processor, alerts } = createProcessor({ "user-failing": failure });
    const lastAttempt = STORE_SUBSCRIPTION_RECONCILE_QUEUE.retry.retryLimit + 1;

    // When
    const retried = processor.process([job("user-failing", 1)]);
    const exhausted = processor.process([job("user-failing", lastAttempt)]);

    // Then
    await expect(retried).rejects.toBe(failure);
    await expect(exhausted).rejects.toBe(failure);
    expect(alerts.map((alert) => alert.details?.attempt)).toEqual([lastAttempt]);
  });

  it("한 잡이 실패해도 나머지를 대조한 뒤 첫 실패를 던진다", async () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const failure = new TypeError("store read failed");
    const { processor, receivedNows } = createProcessor({
      "user-failing": failure,
      "user-same": { correctedCount: 0, fields: [] },
    });

    // When
    const processed = processor.process([job("user-failing"), job("user-same")]);

    // Then
    await expect(processed).rejects.toBe(failure);
    expect(receivedNows).toHaveLength(2);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ failedCount: 1, unchangedCount: 1, errorTypes: ["TypeError"] }),
    );
  });
});
