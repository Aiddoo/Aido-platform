import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

const PREMIUM_GRANT_SWEEP_JOB_NAME = "sweep-premium-grants";

// 옛 스케줄이 넣은 작업이 { name, data: {} } 모양이라 그대로 받는다
const premiumGrantSweepPayloadSchema = z.object({
  name: z.literal(PREMIUM_GRANT_SWEEP_JOB_NAME),
  data: z.object({}),
});

// 프리미엄 종료 시각은 엔타이틀먼트가 User의 만료 시각으로 직접 판단한다. sweep은 끝난 기간을 닫고
// 다음 기간을 앞 기간의 끝부터 이어 붙이므로 주기가 늦어도 판단·기간을 잃지 않는다. 주기는 정리 지연만 정한다.
// 놓친 실행은 다음 10분 주기가 모두 이어 받으므로 missed는 skip이다
export const PREMIUM_GRANT_SWEEP_QUEUE = defineQueue({
  name: "premium-grant-sweep.v1",
  payloadSchema: premiumGrantSweepPayloadSchema,
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
      key: "premium-grant-sweep-scheduler",
      cron: "*/10 * * * *",
      timezone: "UTC",
      missed: "skip",
      payload: { name: PREMIUM_GRANT_SWEEP_JOB_NAME, data: {} },
    },
  ],
});
