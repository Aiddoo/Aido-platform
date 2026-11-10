import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const PLAN_APPLICATION_CLEANUP_QUEUE = "voice-plan-application-cleanup.v1";
export const PLAN_APPLICATION_CLEANUP_JOB_NAME = "purge-plan-applications";

export const PLAN_APPLICATION_CLEANUP_SCHEDULE = {
  id: "daily-plan-application-cleanup-scheduler",
  cron: "20 3 * * *",
  /** 사용자 시간대와 무관한 운영 배치로, 한국 새벽 저트래픽 시간에 돈다 */
  timezone: "Asia/Seoul",
};

export const PLAN_APPLICATION_CLEANUP_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: PLAN_APPLICATION_CLEANUP_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;
