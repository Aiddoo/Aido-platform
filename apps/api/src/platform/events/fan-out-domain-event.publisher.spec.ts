import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";

import {
  AfterCommitTaskRegistryPort,
  defineEventSubscription,
  defineQueue,
  type AfterCommitTask,
  type PublishedDomainEvent,
} from "#api/shared/application/ports/index";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { EventSubscriptionCatalog } from "./event-subscription.catalog.js";
import { FanOutDomainEventPublisher } from "./fan-out-domain-event.publisher.js";

class RecordingAfterCommitTasks extends AfterCommitTaskRegistryPort {
  readonly tasks: AfterCommitTask[] = [];

  register(task: AfterCommitTask): void {
    this.tasks.push(task);
  }
}

const payloadSchema = z.object({ memoId: z.string() });
const ACTIVITY_QUEUE = defineQueue({
  name: "activity.v1",
  payloadSchema,
  retry: {
    retryLimit: 1,
    retryDelaySeconds: 1,
    retryBackoff: false,
    expireInSeconds: 60,
    retentionSeconds: 60,
    deleteAfterSeconds: 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: 2 },
});
const ACTIVITY = defineEventSubscription({
  name: "social.memo-activity",
  eventName: "notes.memo.pinned",
  delivery: "durable",
  payloadSchema,
  queue: ACTIVITY_QUEUE,
});

function memoPinned(payload: Record<string, unknown>): PublishedDomainEvent {
  return {
    eventName: "notes.memo.pinned",
    eventId: "event-1",
    occurredAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
    toPayload: () => payload,
  };
}

function createPublisher(jobQueue: InMemoryJobQueue) {
  const eventEmitter = new EventEmitter2();
  return new FanOutDomainEventPublisher(
    new EventSubscriptionCatalog([ACTIVITY]),
    jobQueue,
    new RecordingAfterCommitTasks(),
    eventEmitter,
  );
}

describe("FanOutDomainEventPublisher — 구독별 전달", () => {
  it("durable 구독은 이벤트 id와 구독 이름으로 만든 key로 그 큐에 넣는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();

    // When
    await createPublisher(jobQueue).publish([memoPinned({ memoId: "memo-1" })]);

    // Then
    expect(jobQueue.jobsIn(ACTIVITY_QUEUE)).toEqual([
      {
        queue: "activity.v1",
        payload: { memoId: "memo-1" },
        options: { idempotencyKey: "event-1:social.memo-activity" },
      },
    ]);
  });

  it("payload가 구독 schema와 맞지 않으면 작업을 넣지 않고 실패한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();

    // When
    const publishing = createPublisher(jobQueue).publish([memoPinned({ memoId: 42 })]);

    // Then
    await expect(publishing).rejects.toThrow(z.ZodError);
    expect(jobQueue.jobs).toEqual([]);
  });
});

describe("EventSubscriptionCatalog — 구독 목록", () => {
  it("구독 이름이 겹치면 멱등 key가 충돌하므로 조립 때 실패한다", () => {
    // When
    const build = () => new EventSubscriptionCatalog([ACTIVITY, { ...ACTIVITY }]);

    // Then
    expect(build).toThrow("Duplicate event subscription name: social.memo-activity");
  });
});
