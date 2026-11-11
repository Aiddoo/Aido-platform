import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

// 옛 스케줄이 넣은 작업이 빈 객체라 그대로 받는다
const quotaAbandonedRefundPayloadSchema = z.object({});

// 프로세스가 죽어 끝나지 못한 예약을 주기적으로 돌려준다. 주기는 환불 지연만 정하고 놓친 실행은 다음 10분 주기가
// 남은 예약을 모두 이어 받으므로 missed는 skip이다
export const QUOTA_ABANDONED_REFUND_QUEUE = defineQueue({
  name: "quota-abandoned-refund.v1",
  payloadSchema: quotaAbandonedRefundPayloadSchema,
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 9 * 60,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "quota-abandoned-refund-scheduler",
      cron: "*/10 * * * *",
      timezone: "UTC",
      missed: "skip",
      payload: {},
    },
  ],
});
