import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const PREMIUM_GRANT_SWEEP_QUEUE = "premium-grant-sweep.v1";
export const PREMIUM_GRANT_SWEEP_JOB_NAME = "sweep-premium-grants";
export type PremiumGrantSweepJobData = Record<string, never>;

// 보상 기간 종료는 몇 분 늦어도 되지만 엔타이틀먼트 캐시 TTL(10분)보다 길게 두지 않는다
export const PREMIUM_GRANT_SWEEP_SCHEDULE = {
  id: "premium-grant-sweep-scheduler",
  cron: "*/10 * * * *",
  timezone: "UTC",
};

export const PREMIUM_GRANT_SWEEP_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInSeconds: 9 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: PREMIUM_GRANT_SWEEP_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;
