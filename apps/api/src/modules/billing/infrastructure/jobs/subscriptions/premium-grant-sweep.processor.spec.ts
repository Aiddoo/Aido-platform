import { mock } from "vitest-mock-extended";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { PremiumGrantSweepProcessor } from "./premium-grant-sweep.processor.js";

const RESULT = { notifiedCount: 0, deferredCount: 0, skippedCount: 0, hasRemaining: false };

describe("PremiumGrantSweepProcessor — 보상 정리와 결제 안내 주기", () => {
  it("한 안내 단계가 실패해도 다음 안내를 보내고 잡은 실패로 끝내 재시도에 맡긴다", async () => {
    // Given
    const ran: string[] = [];
    const failure = new Error("trial notice failed");
    const step = (name: string, error?: Error) => ({
      execute: async () => {
        ran.push(name);
        if (error != null) {
          throw error;
        }
        return RESULT;
      },
    });
    const processor = new PremiumGrantSweepProcessor(
      {
        execute: async () => {
          ran.push("sweep");
          return {
            userCount: 0,
            changedGrantCount: 0,
            failedUserCount: 0,
            hasRemaining: false,
            lapsedUserCount: 0,
            lapsedFailedUserCount: 0,
            hasRemainingLapsed: false,
          };
        },
      },
      step("premium-grant-ending"),
      step("trial-ending", failure),
      step("renewal-upcoming"),
      mock<JobRuntimePort>(),
    );

    // When
    const processed = processor.process();

    // Then
    await expect(processed).rejects.toBe(failure);
    expect(ran).toEqual(["sweep", "premium-grant-ending", "trial-ending", "renewal-upcoming"]);
  });
});
