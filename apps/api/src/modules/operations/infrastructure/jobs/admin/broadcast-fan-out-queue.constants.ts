import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const BROADCAST_FAN_OUT_QUEUE = "operations.broadcast-fan-out.v1";
export const BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE = "operations.broadcast-fan-out-dead-letter.v1";

export const BroadcastFanOutJobName = {
  FAN_OUT: "fan-out-campaign",
} as const;

export const BroadcastFanOutJobSchema = z.strictObject({
  name: z.literal(BroadcastFanOutJobName.FAN_OUT),
  data: z.strictObject({ campaignId: z.string().min(1) }),
});

export type BroadcastFanOutJob = z.output<typeof BroadcastFanOutJobSchema>;

const DAY_SECONDS = 24 * 60 * 60;

/** 한 실행은 분배 예산(60초) 뒤 다음 cursor 작업을 남기므로 만료는 그보다 넉넉하다. */
export const BROADCAST_FAN_OUT_JOB_POLICY = {
  retryLimit: 5,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * DAY_SECONDS,
  deleteAfterSeconds: 7 * DAY_SECONDS,
} as const;

export const BROADCAST_FAN_OUT_DEAD_LETTER_JOB_POLICY = {
  ...BROADCAST_FAN_OUT_JOB_POLICY,
  retryLimit: 3,
  retentionSeconds: 14 * DAY_SECONDS,
  deleteAfterSeconds: 14 * DAY_SECONDS,
} as const;

export const BROADCAST_FAN_OUT_ENQUEUE_POLICY = {
  ...BROADCAST_FAN_OUT_JOB_POLICY,
  deadLetter: {
    queue: BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE,
    jobPolicy: BROADCAST_FAN_OUT_DEAD_LETTER_JOB_POLICY,
  },
} as const;

/** 분배 한 작업은 DB 연결 하나를 페이지마다 잠깐 쓴다. 동시에 한 캠페인만 분배해 HTTP 풀을 남긴다. */
export const BROADCAST_FAN_OUT_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
} as const;

export const BROADCAST_FAN_OUT_DEAD_LETTER_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
  queuePolicy: BROADCAST_FAN_OUT_DEAD_LETTER_JOB_POLICY,
} as const;

/** 같은 캠페인의 같은 cursor 작업은 한 번만 저장된다. 재요청·재시도가 분배를 두 번 시작하지 않는다. */
export function broadcastFanOutJobKey(campaignId: string, cursorUserId: string | null): string {
  return `broadcast-fan-out-${campaignId}-${cursorUserId ?? "start"}`;
}
