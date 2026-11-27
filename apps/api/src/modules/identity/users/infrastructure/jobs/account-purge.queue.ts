import { z } from "zod";

import { JOB_SCHEDULE_TIMEZONE } from "#api/shared/application/job-schedule-timezone";
import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

export const ACCOUNT_PURGE_JOB_NAME = "purge-accounts";
export const ACCOUNT_PURGE_SCHEDULE = {
  timezone: JOB_SCHEDULE_TIMEZONE,
  catchUpHour: 3,
} as const;

// payload는 실행 신호일 뿐이라 이전 일정의 `{ name, data }`와 빈 payload를 모두 받는다
export const ACCOUNT_PURGE_QUEUE = defineQueue({
  name: "account-purge.v1",
  payloadSchema: z.object({ name: z.literal(ACCOUNT_PURGE_JOB_NAME).optional() }),
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 5,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
    retentionSeconds: 7 * DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-account-purge-scheduler",
      cron: "0 3 * * *",
      timezone: JOB_SCHEDULE_TIMEZONE,
      missed: "skip",
      payload: { name: ACCOUNT_PURGE_JOB_NAME },
    },
  ],
});

export const AccountPurgeJobKey = {
  catchUp: (localDate: string): string => `purge_${localDate}`,
};
