import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const MARKETING_CONSENT_RECONFIRM_QUEUE = "notification.marketing-consent-reconfirm.v1";
export const MARKETING_CONSENT_RECONFIRM_JOB_NAME = "reconfirm-marketing-consents";
export type MarketingConsentReconfirmJobData = Record<string, never>;

// 2년 기준이 하루 단위라 한 달에 한 번이면 충분하다. 한국 낮 시간에 돌아 야간 푸시를 피한다
export const MARKETING_CONSENT_RECONFIRM_SCHEDULE = {
  id: "monthly-marketing-consent-reconfirm-scheduler",
  cron: "0 11 1 * *",
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
