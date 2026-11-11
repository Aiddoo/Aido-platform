import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { pushDeliveryJobKey } from "./notification-job-keys.constants.js";
import { PushDeliveryQueueAdapter } from "./push-delivery-queue.adapter.js";
import {
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE,
  PushDeliveryJobName,
} from "./push-delivery.queue.js";

describe("PushDeliveryQueueAdapter — durable push queue 발행", () => {
  it("모듈 초기화 시 1분 recovery relay 예약을 DLQ 없이 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new PushDeliveryQueueAdapter(jobQueue);

    // When
    adapter.onModuleInit();
    await adapter.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual([PUSH_DELIVERY_QUEUE.name]);
    expect(PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE).toMatchObject({
      name: "push-delivery.v1",
      retry: PUSH_DELIVERY_QUEUE.retry,
      schedules: [
        {
          key: "push-delivery-outbox-relay-scheduler",
          cron: "* * * * *",
          missed: "skip",
          payload: { name: PushDeliveryJobName.RELAY_OUTBOX, data: {} },
        },
      ],
    });
    expect(PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE.deadLetter).toBeUndefined();
  });

  it("거래성 publication은 우선순위 10, 마케팅은 0으로 같은 generation key와 DLQ 정의에 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new PushDeliveryQueueAdapter(jobQueue);
    const reminder = [{ dispatchId: 11, publishAttempt: 2 }];
    const campaign = [
      { dispatchId: 21, publishAttempt: 1 },
      { dispatchId: 20, publishAttempt: 1 },
    ];

    // When
    await adapter.enqueueDeliveries(reminder, "TRANSACTIONAL");
    await adapter.enqueueDeliveries(campaign, "MARKETING");

    // Then
    expect(jobQueue.jobsIn(PUSH_DELIVERY_QUEUE)).toEqual([
      {
        queue: "push-delivery.v1",
        payload: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: reminder },
        options: { idempotencyKey: pushDeliveryJobKey(reminder), priority: 10 },
      },
      {
        queue: "push-delivery.v1",
        payload: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: campaign },
        options: { idempotencyKey: pushDeliveryJobKey(campaign), priority: 0 },
      },
    ]);
    expect(PUSH_DELIVERY_QUEUE.deadLetter).toEqual({
      queue: PUSH_DELIVERY_DEAD_LETTER_QUEUE.name,
      jobPolicy: PUSH_DELIVERY_DEAD_LETTER_QUEUE.retry,
    });
  });

  it("같은 generation을 다시 발행해 큐가 중복으로 거절해도 성공으로 처리한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new PushDeliveryQueueAdapter(jobQueue);
    const publications = [{ dispatchId: 11, publishAttempt: 2 }];
    await adapter.enqueueDeliveries(publications, "TRANSACTIONAL");

    // When
    const republishing = adapter.enqueueDeliveries(publications, "TRANSACTIONAL");

    // Then
    await expect(republishing).resolves.toBeUndefined();
    expect(jobQueue.jobsIn(PUSH_DELIVERY_QUEUE)).toHaveLength(1);
  });
});
