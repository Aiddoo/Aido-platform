import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { JobQueueLifecycle } from "./job-queue.module.js";

describe("JobQueueLifecycle — 작업 큐 수명주기", () => {
  it("애플리케이션 시작과 종료를 작업 큐에 위임한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const lifecycle = new JobQueueLifecycle(jobQueue);

    // When
    await lifecycle.onApplicationBootstrap();
    const startedAfterBootstrap = jobQueue.running;
    await lifecycle.beforeApplicationShutdown();

    // Then
    expect([startedAfterBootstrap, jobQueue.running]).toEqual([true, false]);
  });
});
