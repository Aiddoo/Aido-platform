import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const ACCOUNT_PURGE_QUEUE = "account-purge.v1";
export const ACCOUNT_PURGE_JOB_NAME = "purge-accounts";
export type AccountPurgeJobData = Record<string, never>;

export const ACCOUNT_PURGE_SCHEDULE = {
  id: "daily-account-purge-scheduler",
  cron: "0 3 * * *",
  /** 사용자 시간대와 무관한 운영 배치로, 한국 새벽 저트래픽 시간에 돈다 */
  timezone: "Asia/Seoul",
  catchUpHour: 3,
};

export const ACCOUNT_PURGE_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: ACCOUNT_PURGE_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;

export const AccountPurgeJobKey = {
  catchUp: (localDate: string): string => `purge_${localDate}`,
};
