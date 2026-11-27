import { z } from "zod";

import { JOB_SCHEDULE_TIMEZONE } from "#api/shared/application/job-schedule-timezone";
import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const STALE_PUSH_TOKEN_PRUNE_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// 사용자 시간대와 무관한 운영 정리라 다른 새벽 정리(03:00~03:50·04:30 KST)와 겹치지 않는 04:10에 돈다.
// 멱등이고 다음 실행이 남은 토큰을 이어 끄므로 놓친 실행은 버린다
export const STALE_PUSH_TOKEN_PRUNE_QUEUE = defineQueue({
  name: "notification.stale-push-token-prune.v1",
  payloadSchema: z.object({}),
  retry: STALE_PUSH_TOKEN_PRUNE_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-stale-push-token-prune-scheduler",
      cron: "10 4 * * *",
      timezone: JOB_SCHEDULE_TIMEZONE,
      missed: "skip",
      payload: {},
    },
  ],
});
