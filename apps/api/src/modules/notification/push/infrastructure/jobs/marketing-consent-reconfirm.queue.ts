import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

const MARKETING_CONSENT_RECONFIRM_JOB_NAME = "reconfirm-marketing-consents";

const MARKETING_CONSENT_RECONFIRM_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

const MarketingConsentReconfirmJobSchema = z.object({
  name: z.literal(MARKETING_CONSENT_RECONFIRM_JOB_NAME),
  data: z.object({}),
});

// 야간 사용자는 건너뛰고 남겨 두므로, 어느 시간대든 낮 시간에 한 번은 돌도록 매시 정각에 돈다.
// 하루 한 번(10:00 KST)이면 그 시각이 현지 야간인 유럽·인도·미국 동부(서머타임) 사용자는 영영 받지 못한다.
// 대상이 없으면 인덱스 조회 한 번으로 끝나고, 놓친 실행은 다음 실행이 같은 조건으로 이어 받는다
export const MARKETING_CONSENT_RECONFIRM_QUEUE = defineQueue({
  name: "notification.marketing-consent-reconfirm.v1",
  payloadSchema: MarketingConsentReconfirmJobSchema,
  retry: MARKETING_CONSENT_RECONFIRM_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "hourly-marketing-consent-reconfirm-scheduler",
      cron: "0 * * * *",
      timezone: "Asia/Seoul",
      missed: "skip",
      payload: { name: MARKETING_CONSENT_RECONFIRM_JOB_NAME, data: {} },
    },
  ],
});
