import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { RetentionQueueProcessor } from "./retention-queue.processor.js";
import { RETENTION_QUEUE, RetentionJobName } from "./retention.queue.js";

describe("RetentionQueueProcessor — 리텐션 작업 처리", () => {
  it("단계 sweep 작업은 단계 처리로 넘기고 이전 배포가 남긴 발송 작업은 처리 없이 완료한다", async () => {
    // Given
    let executions = 0;
    const jobQueue = new InMemoryJobQueue();
    const processor = new RetentionQueueProcessor(
      {
        execute: async () => {
          executions += 1;
        },
      },
      jobQueue,
    );
    await processor.onModuleInit();
    await jobQueue.enqueue(RETENTION_QUEUE, {
      name: "retention-dispatch",
      data: { outboxId: "outbox-1" },
    });
    await jobQueue.enqueue(RETENTION_QUEUE, { name: "retention-outbox-relay", data: {} });
    await jobQueue.enqueue(RETENTION_QUEUE, { name: RetentionJobName.STAGE_SWEEP, data: {} });

    // When
    await jobQueue.drain(RETENTION_QUEUE);

    // Then
    expect(executions).toBe(1);
  });
});
