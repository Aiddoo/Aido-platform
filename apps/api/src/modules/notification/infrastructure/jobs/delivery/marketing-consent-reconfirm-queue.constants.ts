import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const MARKETING_CONSENT_RECONFIRM_QUEUE = "notification.marketing-consent-reconfirm.v1";
export const MARKETING_CONSENT_RECONFIRM_JOB_NAME = "reconfirm-marketing-consents";

// 야간 사용자는 건너뛰고 남겨 두므로, 어느 시간대든 낮 시간에 한 번은 돌도록 매시 정각에 돈다.
// 대상이 없으면 인덱스 조회 한 번으로 끝난다
export const MARKETING_CONSENT_RECONFIRM_SCHEDULE = {
  id: "hourly-marketing-consent-reconfirm-scheduler",
  cron: "0 * * * *",
  timezone: "Asia/Seoul",
};

export const MARKETING_CONSENT_RECONFIRM_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
  timezone: MARKETING_CONSENT_RECONFIRM_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;
