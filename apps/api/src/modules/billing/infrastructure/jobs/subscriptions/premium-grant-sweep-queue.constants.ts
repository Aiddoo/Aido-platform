import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const PREMIUM_GRANT_SWEEP_QUEUE = "premium-grant-sweep.v1";
export const PREMIUM_GRANT_SWEEP_JOB_NAME = "sweep-premium-grants";
export type PremiumGrantSweepJobData = Record<string, never>;

// 프리미엄 종료 시각은 엔타이틀먼트가 User의 만료 시각으로 직접 판단한다. sweep은 끝난 기간을 닫고
// 다음 기간을 앞 기간의 끝부터 이어 붙이므로 주기가 늦어도 판단·기간을 잃지 않는다. 주기는 정리 지연만 정한다
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
