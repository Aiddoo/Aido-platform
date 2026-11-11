import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { InviteRewardProcessor } from "./invite-reward.processor.js";
import { INVITE_REWARD_QUEUE } from "./invite-reward.queue.js";

describe("InviteRewardProcessor — Queue 실행 경계", () => {
  it("수락 ID를 지급 흐름에 넘기고 첫 실행만 정비 재시도 예산을 쓴다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
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
      jobQueue,
    );
    await processor.onModuleInit();

    // When
    await jobQueue.enqueue(INVITE_REWARD_QUEUE, { redemptionId: "redemption-1" });
    await jobQueue.drain(INVITE_REWARD_QUEUE);

    // Then
    expect(redemptionIds).toEqual(["redemption-1"]);
    expect(countedAttempts).toEqual([true]);
  });

  it("지급 실패는 Queue의 backoff 재시도로 전파한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const failure = new Error("grant failed");
    const processor = new InviteRewardProcessor(
      {
        execute: async () => {
          throw failure;
        },
      },
      jobQueue,
    );
    await processor.onModuleInit();
    await jobQueue.enqueue(INVITE_REWARD_QUEUE, { redemptionId: "redemption-1" });

    // When
    const result = jobQueue.drain(INVITE_REWARD_QUEUE);

    // Then
    await expect(result).rejects.toBe(failure);
  });
});
