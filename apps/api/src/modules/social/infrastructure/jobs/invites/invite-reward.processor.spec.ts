import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { InviteRewardProcessor } from "./invite-reward.processor.js";

describe("InviteRewardProcessor — Queue 실행 경계", () => {
  it("수락 ID가 있는 작업만 지급 흐름에 넘기고 형식이 틀린 payload는 재시도하지 않는다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const redemptionIds: string[] = [];
    const countedAttempts: boolean[] = [];
    const processor = new InviteRewardProcessor(
      {
        execute: async ({ redemptionId, countsAttempt }) => {
          redemptionIds.push(redemptionId);
          countedAttempts.push(countsAttempt);
          return { appliedCount: 1, failedCount: 0 };
        },
      },
      runtime,
    );
    await processor.onModuleInit();

    // When
    await runtime.run("invite-reward.v1", { redemptionId: "redemption-1" });
    await runtime.run("invite-reward.v1", { unexpected: true });

    // Then
    expect(runtime.workCalls).toEqual([
      {
        queue: "invite-reward.v1",
        options: expect.objectContaining({ teamSize: 2, pollingIntervalSeconds: 30 }),
      },
    ]);
    expect(redemptionIds).toEqual(["redemption-1"]);
    // 첫 실행만 정비 재시도 예산을 쓴다
    expect(countedAttempts).toEqual([true]);
  });

  it("지급 실패는 Queue의 backoff 재시도로 전파한다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const failure = new Error("grant failed");
    const processor = new InviteRewardProcessor(
      {
        execute: async () => {
          throw failure;
        },
      },
      runtime,
    );
    await processor.onModuleInit();

    // When
    const result = runtime.run("invite-reward.v1", { redemptionId: "redemption-1" });

    // Then
    await expect(result).rejects.toBe(failure);
  });
});
