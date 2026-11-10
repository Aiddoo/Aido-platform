import { Logger } from "@nestjs/common";
import { mock } from "vitest-mock-extended";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { BillingLogEvent } from "../../application/subscriptions.log-events.js";
import type { ReconcileStoreSubscriptionsResult } from "../../application/use-cases/reconcile-store-subscriptions.use-case.js";
import { StoreSubscriptionReconcileProcessor } from "./store-subscription-reconcile.processor.js";
import {
  STORE_SUBSCRIPTION_RECONCILE_JOB_NAME,
  STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY,
} from "./store-subscription-reconcile.queue.js";

const job = (userId: string, attempt = 1) => ({
  data: { name: STORE_SUBSCRIPTION_RECONCILE_JOB_NAME, data: { userId } },
  attempt,
});

function createProcessor(
  results: Readonly<Record<string, ReconcileStoreSubscriptionsResult | Error>>,
) {
  const alerts: OperationalAlert[] = [];
  const alert: OperationalAlertPort = { raise: (input) => void alerts.push(input) };
  const processor = new StoreSubscriptionReconcileProcessor(
    {
      execute: async ({ userId }) => {
        const result = results[userId] ?? new Error("unknown user");
        if (result instanceof Error) {
          throw result;
        }
        return result;
      },
    },
    alert,
    mock<JobRuntimePort>(),
  );
  return { processor, alerts };
}

describe("StoreSubscriptionReconcileProcessor — 대조 잡 요약 로그", () => {
  it("고친·같은·형식이 틀린 잡을 사용자 ID 없이 요약 한 건으로 남긴다", async () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { processor } = createProcessor({
      "user-corrected": { correctedCount: 2, fields: ["expiresAt", "status"] },
      "user-same": { correctedCount: 0, fields: [] },
    });

    // When
    await processor.process([job("user-corrected"), job("user-same"), { data: {}, attempt: 1 }]);

    // Then
    expect(warn).toHaveBeenCalledExactlyOnceWith({
      event: BillingLogEvent.RECONCILE_COMPLETED,
      jobCount: 3,
      correctedUserCount: 1,
      correctedChainCount: 2,
      unchangedCount: 1,
      fields: ["expiresAt", "status"],
      invalidCount: 1,
      failedCount: 0,
      errorTypes: [],
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("user-");
  });

  it("실패는 요약에 세고 던져 재시도에 맡기며, 재시도가 끝났을 때만 경보를 올린다", async () => {
    // Given
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const failure = new Error("store read failed");
    const { processor, alerts } = createProcessor({ "user-failing": failure });
    const lastAttempt = STORE_SUBSCRIPTION_RECONCILE_JOB_POLICY.retryLimit + 1;

    // When
    const retried = processor.process([job("user-failing", 1)]);
    const exhausted = processor.process([job("user-failing", lastAttempt)]);

    // Then
    await expect(retried).rejects.toBe(failure);
    await expect(exhausted).rejects.toBe(failure);
    expect(alerts.map((alert) => alert.details?.attempt)).toEqual([lastAttempt]);
  });
});
