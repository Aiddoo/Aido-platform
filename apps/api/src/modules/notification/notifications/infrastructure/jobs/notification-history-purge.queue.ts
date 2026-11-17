import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const NOTIFICATION_HISTORY_PURGE_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// 사용자 시간대와 무관한 운영 정리라 다른 새벽 정리(03:00~03:40·04:30 KST)와 겹치지 않는 03:50에 돈다.
// 멱등이고 다음 실행이 남은 행을 이어 지우므로 놓친 실행은 버린다
export const NOTIFICATION_HISTORY_PURGE_QUEUE = defineQueue({
  name: "notification.history-purge.v1",
  payloadSchema: z.object({}),
  retry: NOTIFICATION_HISTORY_PURGE_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-notification-history-purge-scheduler",
      cron: "50 3 * * *",
      timezone: "Asia/Seoul",
      missed: "skip",
      payload: {},
    },
  ],
});
