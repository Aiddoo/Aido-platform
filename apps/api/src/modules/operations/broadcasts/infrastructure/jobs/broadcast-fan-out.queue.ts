import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

export const BroadcastFanOutJobName = {
  FAN_OUT: "fan-out-campaign",
} as const;

// 큐에 쌓인 옛 작업과 같은 모양이다. cursor는 캠페인 행이 들고 있어 payload에는 없다
const broadcastFanOutJobSchema = z.strictObject({
  name: z.literal(BroadcastFanOutJobName.FAN_OUT),
  data: z.strictObject({ campaignId: z.string().min(1) }),
});

const DAY_SECONDS = 24 * 60 * 60;

/** 한 실행은 분배 예산(60초) 뒤 다음 cursor 작업을 남기므로 만료는 그보다 넉넉하다. */
const BROADCAST_FAN_OUT_RETRY = {
  retryLimit: 5,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * DAY_SECONDS,
  deleteAfterSeconds: 7 * DAY_SECONDS,
} as const;

const BROADCAST_FAN_OUT_DEAD_LETTER_RETRY = {
  ...BROADCAST_FAN_OUT_RETRY,
  retryLimit: 3,
  retentionSeconds: 14 * DAY_SECONDS,
  deleteAfterSeconds: 14 * DAY_SECONDS,
} as const;

const BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE_NAME = "operations.broadcast-fan-out-dead-letter.v1";

// 분배 한 작업은 DB 연결 하나를 페이지마다 잠깐 쓴다. 동시에 한 캠페인만 분배해 HTTP 풀을 남긴다
export const BROADCAST_FAN_OUT_QUEUE = defineQueue({
  name: "operations.broadcast-fan-out.v1",
  payloadSchema: broadcastFanOutJobSchema,
  retry: BROADCAST_FAN_OUT_RETRY,
  deadLetter: {
    queue: BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE_NAME,
    jobPolicy: BROADCAST_FAN_OUT_DEAD_LETTER_RETRY,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
});

export const BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE = defineQueue({
  name: BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE_NAME,
  payloadSchema: broadcastFanOutJobSchema,
  retry: BROADCAST_FAN_OUT_DEAD_LETTER_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});

/** 같은 캠페인의 같은 cursor 작업은 한 번만 저장된다. 재요청·재시도가 분배를 두 번 시작하지 않는다. */
export function broadcastFanOutJobKey(campaignId: string, cursorUserId: string | null): string {
  return `broadcast-fan-out-${campaignId}-${cursorUserId ?? "start"}`;
}
