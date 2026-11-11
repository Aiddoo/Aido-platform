import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

import { PUSH_DELIVERY_JOB_MAX_PUBLICATIONS } from "../../application/read-models/push-delivery.read-model.js";
import type { PushDeliveryLane } from "../../domain/push-delivery-lane.domain-service.js";

const PUSH_DELIVERY_RELAY_SCHEDULE = {
  key: "push-delivery-outbox-relay-scheduler",
  cron: "* * * * *",
} as const;

export const PushDeliveryJobName = {
  RELAY_OUTBOX: "relay-outbox",
  DELIVER_DISPATCHES: "deliver-dispatches",
} as const;

// 거래성 전용 worker가 minPriority로 이 값 이상만 가져가 대량 마케팅이 리마인더를 밀어내지 않는다
export const PUSH_DELIVERY_PRIORITY = {
  TRANSACTIONAL: 10,
  MARKETING: 0,
} as const satisfies Record<PushDeliveryLane, number>;

const PushDeliveryPublicationSchema = z.strictObject({
  dispatchId: z.number().int().positive(),
  publishAttempt: z.number().int().positive(),
});

const PushDeliveryPublicationBatchSchema = z
  .array(PushDeliveryPublicationSchema)
  .min(1)
  .max(PUSH_DELIVERY_JOB_MAX_PUBLICATIONS)
  .check(({ value: publications, issues }) => {
    const dispatchIds = new Set<number>();
    for (const publication of publications) {
      if (dispatchIds.has(publication.dispatchId)) {
        issues.push({
          code: "custom",
          input: publications,
          message: `Duplicate dispatchId: ${publication.dispatchId}`,
        });
      }
      dispatchIds.add(publication.dispatchId);
    }
  });

const DeliverPushNotificationsJobSchema = z.strictObject({
  name: z.literal(PushDeliveryJobName.DELIVER_DISPATCHES),
  data: PushDeliveryPublicationBatchSchema,
});

export const PushDeliveryRuntimeJobSchema = z.discriminatedUnion("name", [
  z.strictObject({
    name: z.literal(PushDeliveryJobName.RELAY_OUTBOX),
    data: z.strictObject({}),
  }),
  DeliverPushNotificationsJobSchema,
]);

// Native DLQ는 원본 delivery payload만 받고 relay 작업은 받지 않는다
export const PushDeliveryDeadLetterJobSchema = DeliverPushNotificationsJobSchema;

const PUSH_DELIVERY_RETRY = {
  retryLimit: 5,
  retryDelaySeconds: 1,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

const PUSH_DELIVERY_DEAD_LETTER_RETRY = {
  ...PUSH_DELIVERY_RETRY,
} as const satisfies JobRetryPolicy;

export const PUSH_DELIVERY_DEAD_LETTER_QUEUE = defineQueue({
  name: "push-delivery-dead-letter.v1",
  payloadSchema: PushDeliveryDeadLetterJobSchema,
  retry: PUSH_DELIVERY_DEAD_LETTER_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
});

// 앱 풀 10을 나눠 쓰므로 일반 3 + 거래성 전용 2로 옛 동시성(5)을 넘지 않는다.
// 한 작업의 실패가 묶음의 다른 publication까지 재시도·DLQ로 보내지 않게 작업마다 끝낸다
export const PUSH_DELIVERY_QUEUE = defineQueue({
  name: "push-delivery.v1",
  payloadSchema: PushDeliveryRuntimeJobSchema,
  retry: PUSH_DELIVERY_RETRY,
  deadLetter: {
    queue: PUSH_DELIVERY_DEAD_LETTER_QUEUE.name,
    jobPolicy: PUSH_DELIVERY_DEAD_LETTER_RETRY,
  },
  worker: {
    localConcurrency: 3,
    pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
    batchSize: 3,
    burstWhenBatchFull: true,
    isolateJobFailures: true,
  },
});

// 같은 큐의 두 번째 worker. 거래성 작업만 가져가 마케팅 적체와 상관없이 비어 있는 자리를 둔다
export const PUSH_DELIVERY_TRANSACTIONAL_QUEUE = defineQueue({
  ...PUSH_DELIVERY_QUEUE,
  worker: {
    ...PUSH_DELIVERY_QUEUE.worker,
    localConcurrency: 2,
    minPriority: PUSH_DELIVERY_PRIORITY.TRANSACTIONAL,
  },
});

// 예약 relay는 DLQ 없이 다음 실행이 이어 받는다. DLQ schema가 relay payload를 받지 않기 때문이다
export const PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE = defineQueue({
  name: PUSH_DELIVERY_QUEUE.name,
  payloadSchema: PushDeliveryRuntimeJobSchema,
  retry: PUSH_DELIVERY_RETRY,
  worker: PUSH_DELIVERY_QUEUE.worker,
  schedules: [
    {
      key: PUSH_DELIVERY_RELAY_SCHEDULE.key,
      cron: PUSH_DELIVERY_RELAY_SCHEDULE.cron,
      timezone: "UTC",
      missed: "skip",
      payload: { name: PushDeliveryJobName.RELAY_OUTBOX, data: {} },
    },
  ],
});
