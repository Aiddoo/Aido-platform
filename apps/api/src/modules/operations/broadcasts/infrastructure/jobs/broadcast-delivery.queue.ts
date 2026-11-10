import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

import { BROADCAST_FAN_OUT_PAGE_SIZE } from "../../domain/broadcasts.constants.js";

export const BroadcastDeliveryJobName = {
  DELIVER_GROUP: "deliver-group",
} as const;

// 수신자 현지 시각에 맞춰 알림을 만들 묶음. 한 묶음은 분배 한 페이지 안의 사용자라 페이지 크기를 넘지 않는다
const broadcastDeliveryJobSchema = z.strictObject({
  name: z.literal(BroadcastDeliveryJobName.DELIVER_GROUP),
  data: z.strictObject({
    campaignId: z.string().min(1),
    userIds: z.array(z.string().min(1)).min(1).max(BROADCAST_FAN_OUT_PAGE_SIZE),
  }),
});

const DAY_SECONDS = 24 * 60 * 60;

const BROADCAST_DELIVERY_RETRY = {
  retryLimit: 5,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * DAY_SECONDS,
  deleteAfterSeconds: 7 * DAY_SECONDS,
} as const;

const BROADCAST_DELIVERY_DEAD_LETTER_RETRY = {
  ...BROADCAST_DELIVERY_RETRY,
  retryLimit: 3,
  retentionSeconds: 14 * DAY_SECONDS,
  deleteAfterSeconds: 14 * DAY_SECONDS,
} as const;

const BROADCAST_DELIVERY_DEAD_LETTER_QUEUE_NAME = "operations.broadcast-delivery-dead-letter.v1";

// 알림 행과 발송 outbox를 쓰는 묶음이라 분배와 같이 동시에 하나만 처리한다
export const BROADCAST_DELIVERY_QUEUE = defineQueue({
  name: "operations.broadcast-delivery.v1",
  payloadSchema: broadcastDeliveryJobSchema,
  retry: BROADCAST_DELIVERY_RETRY,
  deadLetter: {
    queue: BROADCAST_DELIVERY_DEAD_LETTER_QUEUE_NAME,
    jobPolicy: BROADCAST_DELIVERY_DEAD_LETTER_RETRY,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
});

export const BROADCAST_DELIVERY_DEAD_LETTER_QUEUE = defineQueue({
  name: BROADCAST_DELIVERY_DEAD_LETTER_QUEUE_NAME,
  payloadSchema: broadcastDeliveryJobSchema,
  retry: BROADCAST_DELIVERY_DEAD_LETTER_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});

/** 같은 캠페인·시각·첫 사용자의 묶음은 한 번만 저장된다. 분배 페이지가 다시 돌아도 알림이 두 번 만들어지지 않는다. */
export function broadcastDeliveryJobKey(
  campaignId: string,
  startAfter: string,
  firstUserId: string,
): string {
  return `broadcast-delivery-${campaignId}-${startAfter}-${firstUserId}`;
}
