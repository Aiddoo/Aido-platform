import type { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { AccountPurgeProcessor } from "./account-purge.processor.js";
import { ACCOUNT_PURGE_JOB_NAME, ACCOUNT_PURGE_QUEUE } from "./account-purge.queue.js";

class CountingAccountPurge implements Pick<PurgeDeletedAccountsUseCase, "execute"> {
  runs = 0;

  async execute(): Promise<void> {
    this.runs += 1;
  }
}

describe("AccountPurgeProcessor — Queue 실행 경계", () => {
  it.each([
    { label: "등록된 일정", payload: { name: ACCOUNT_PURGE_JOB_NAME } },
    { label: "name이 없는 옛 payload", payload: {} },
  ] as const)("$label 작업이 계정 정리 흐름을 실행한다", async ({ payload }) => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const purge = new CountingAccountPurge();
    const processor = new AccountPurgeProcessor(purge, jobQueue);
    await processor.onModuleInit();
    await jobQueue.enqueue(ACCOUNT_PURGE_QUEUE, payload);

    // When
    await jobQueue.drain(ACCOUNT_PURGE_QUEUE);

    // Then
    expect(purge.runs).toBe(1);
  });

  it("계정 정리 실행 오류는 Queue의 재시도 판단으로 전파한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const failure = new Error("Database unavailable");
    const processor = new AccountPurgeProcessor(
      {
        execute: async () => {
          throw failure;
        },
      },
      jobQueue,
    );
    await processor.onModuleInit();
    await jobQueue.enqueue(ACCOUNT_PURGE_QUEUE, { name: ACCOUNT_PURGE_JOB_NAME });

    // When
    const result = jobQueue.drain(ACCOUNT_PURGE_QUEUE);

    // Then
    await expect(result).rejects.toBe(failure);
  });
});
