import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

const EXPIRED_RECORD_PURGE_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

// 03시대 일일 정리(03:00·03:10·03:20·03:30)와 10분 띄운다. 놓친 날의 기록은 다음 실행이 같이 지운다
export const EXPIRED_RECORD_PURGE_QUEUE = defineQueue({
  name: "identity.expired-record-purge.v1",
  payloadSchema: z.object({}),
  retry: EXPIRED_RECORD_PURGE_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-expired-record-purge-scheduler",
      cron: "40 3 * * *",
      timezone: "Asia/Seoul",
      missed: "skip",
      payload: {},
    },
  ],
});
