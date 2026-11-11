import { vi } from "vitest";

import type { JobEnvelope, QueueDefinition } from "#api/shared/application/ports/job-queue.port";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { PushDeliveryQueueProcessor } from "./push-delivery-queue.processor.js";
import {
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_TRANSACTIONAL_QUEUE,
  PushDeliveryJobName,
} from "./push-delivery.queue.js";

interface RegisteredWorker {
  readonly queue: QueueDefinition<object>;
  readonly handler: (jobs: readonly JobEnvelope<object>[]) => Promise<void>;
}

// 같은 큐에 붙은 worker 정의를 모두 보려고 등록만 기록한다
class RecordingJobQueue extends InMemoryJobQueue {
  readonly workers: RegisteredWorker[] = [];

  override async work<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<void> {
    this.workers.push({
      queue,
      handler: async (jobs) =>
        handler(jobs.map((job) => ({ ...job, data: queue.payloadSchema.parse(job.data) }))),
    });
    await super.work(queue, handler);
  }
}

async function setup() {
  const relayOutbox = { execute: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  const deliverPushNotifications = {
    execute: vi.fn<(input: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };
  const recoverFailedDeliveries = {
    execute: vi.fn<(input: unknown) => Promise<number>>().mockResolvedValue(1),
  };
  const jobQueue = new RecordingJobQueue();
  const processor = new PushDeliveryQueueProcessor(
    relayOutbox,
    deliverPushNotifications,
    recoverFailedDeliveries,
    jobQueue,
  );
  await processor.onModuleInit();
  return { relayOutbox, deliverPushNotifications, recoverFailedDeliveries, jobQueue };
}

describe("PushDeliveryQueueProcessor — 영속 Push 큐 라우팅", () => {
  it("일반 worker와 우선순위 10 이상만 가져가는 거래성 worker를 같은 큐에 등록한다", async () => {
    // Given / When
    const { jobQueue } = await setup();

    // Then
    expect(
      jobQueue.workers.map(({ queue }) => ({ name: queue.name, worker: queue.worker })),
    ).toEqual([
      { name: "push-delivery.v1", worker: PUSH_DELIVERY_QUEUE.worker },
      {
        name: "push-delivery.v1",
        worker: expect.objectContaining({ minPriority: 10 }),
      },
      { name: "push-delivery-dead-letter.v1", worker: PUSH_DELIVERY_DEAD_LETTER_QUEUE.worker },
    ]);
    expect(PUSH_DELIVERY_QUEUE.worker.minPriority).toBeUndefined();
    expect(PUSH_DELIVERY_TRANSACTIONAL_QUEUE.deadLetter).toEqual(PUSH_DELIVERY_QUEUE.deadLetter);
  });

  it("전용 DLQ worker는 strict delivery publication을 DB recovery use case로 전달한다", async () => {
    // Given
    const units = await setup();
    const publications = [{ dispatchId: 88, publishAttempt: 4 }];
    await units.jobQueue.enqueue(PUSH_DELIVERY_DEAD_LETTER_QUEUE, {
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: publications,
    });

    // When
    await units.jobQueue.drain(PUSH_DELIVERY_DEAD_LETTER_QUEUE);

    // Then
    expect(units.recoverFailedDeliveries.execute).toHaveBeenCalledWith({ publications });
  });

  it("큐의 실제 JobEnvelope.id와 attempt를 delivery fencing으로 전달한다", async () => {
    // Given
    const units = await setup();
    const transactionalWorker = units.jobQueue.workers[1];
    const publications = [{ dispatchId: 31, publishAttempt: 5 }];

    // When
    await transactionalWorker?.handler([
      {
        id: "pg-boss-job-7f9c",
        name: PUSH_DELIVERY_QUEUE.name,
        data: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
        attempt: 3,
      },
    ]);

    // Then
    expect(units.deliverPushNotifications.execute).toHaveBeenCalledWith({
      processingJobId: "pg-boss-job-7f9c",
      processingJobAttempt: 3,
      publications,
      isFinalAttempt: false,
    });
  });

  it("relay job은 delivery use case와 분리해 outbox relay로 라우팅한다", async () => {
    // Given
    const units = await setup();
    await units.jobQueue.enqueue(PUSH_DELIVERY_QUEUE, {
      name: PushDeliveryJobName.RELAY_OUTBOX,
      data: {},
    });

    // When
    await units.jobQueue.drain(PUSH_DELIVERY_QUEUE);

    // Then
    expect(units.relayOutbox.execute).toHaveBeenCalledWith();
    expect(units.deliverPushNotifications.execute).not.toHaveBeenCalled();
  });

  it("retryLimit 이후 마지막 attempt를 outbox reopen 신호로 전달한다", async () => {
    // Given
    const units = await setup();
    const worker = units.jobQueue.workers[0];
    const publications = [{ dispatchId: 32, publishAttempt: 6 }];

    // When
    await worker?.handler([
      {
        id: "final-job",
        name: PUSH_DELIVERY_QUEUE.name,
        data: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
        attempt: 6,
      },
    ]);

    // Then
    expect(units.deliverPushNotifications.execute).toHaveBeenCalledWith({
      processingJobId: "final-job",
      processingJobAttempt: 6,
      publications,
      isFinalAttempt: true,
    });
  });
});
