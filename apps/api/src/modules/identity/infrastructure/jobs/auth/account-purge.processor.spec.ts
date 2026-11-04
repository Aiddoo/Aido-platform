import { vi } from "vitest";

import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { AccountPurgeProcessor } from "./account-purge.processor.js";

describe("AccountPurgeProcessor — Queue 실행 경계", () => {
  it("account-purge.v1 작업이 계정 정리 흐름을 실행한다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const execute = vi.fn().mockResolvedValue(undefined);
    const processor = new AccountPurgeProcessor({ execute }, runtime);

    // When
    await processor.onModuleInit();
    await runtime.run("account-purge.v1", {});

    // Then
    expect(runtime.workCalls).toEqual([
      { queue: "account-purge.v1", options: { teamSize: 1, pollingIntervalSeconds: 30 } },
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
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
