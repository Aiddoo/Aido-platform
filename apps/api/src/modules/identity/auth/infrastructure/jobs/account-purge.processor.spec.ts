import type { PurgeDeletedAccountsUseCase } from "#api/modules/identity/auth/application/use-cases/purge-deleted-accounts.use-case";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { AccountPurgeProcessor } from "./account-purge.processor.js";

class CountingAccountPurge implements Pick<PurgeDeletedAccountsUseCase, "execute"> {
  runs = 0;

  async execute(): Promise<void> {
    this.runs += 1;
  }
}

describe("AccountPurgeProcessor — Queue 실행 경계", () => {
  it("account-purge.v1 작업이 계정 정리 흐름을 실행한다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const purge = new CountingAccountPurge();
    const processor = new AccountPurgeProcessor(purge, runtime);

    // When
    await processor.onModuleInit();
    await runtime.run("account-purge.v1", {});

    // Then
    expect(runtime.workCalls).toEqual([
      { queue: "account-purge.v1", options: { teamSize: 1, pollingIntervalSeconds: 30 } },
    ]);
    expect(purge.runs).toBe(1);
  });

  it("계정 정리 실행 오류는 Queue의 재시도 판단으로 전파한다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const failure = new Error("Database unavailable");
    const processor = new AccountPurgeProcessor(
      {
        execute: async () => {
          throw failure;
        },
      },
      runtime,
    );
    await processor.onModuleInit();

    // When
    const result = runtime.run("account-purge.v1", {});

    // Then
    await expect(result).rejects.toBe(failure);
  });
});
