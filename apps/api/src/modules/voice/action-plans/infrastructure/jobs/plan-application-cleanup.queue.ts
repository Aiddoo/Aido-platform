import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

const PLAN_APPLICATION_CLEANUP_JOB_NAME = "purge-plan-applications";

const PLAN_APPLICATION_CLEANUP_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

// 옛 런타임이 남긴 { name, data } 모양을 그대로 받는다
const PlanApplicationCleanupJobSchema = z.object({
  name: z.literal(PLAN_APPLICATION_CLEANUP_JOB_NAME),
  data: z.object({}),
});

/** 사용자 시간대와 무관한 운영 배치로 한국 새벽 저트래픽 시간에 돈다. 멱등이라 놓친 실행은 한 번 보낸다 */
export const PLAN_APPLICATION_CLEANUP_QUEUE = defineQueue({
  name: "voice-plan-application-cleanup.v1",
  payloadSchema: PlanApplicationCleanupJobSchema,
  retry: PLAN_APPLICATION_CLEANUP_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-plan-application-cleanup-scheduler",
      cron: "20 3 * * *",
      timezone: "Asia/Seoul",
      missed: "once",
      payload: { name: PLAN_APPLICATION_CLEANUP_JOB_NAME, data: {} },
    },
  ],
});
