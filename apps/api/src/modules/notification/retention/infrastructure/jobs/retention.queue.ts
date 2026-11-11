import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

export const RetentionJobName = {
  STAGE_SWEEP: "retention-stage-sweep",
} as const;

// 발송이 공용 push-delivery.v1으로 옮겨지기 전 배포가 남긴 작업이다. 실패로 쌓이지 않게 받아서 처리 없이 끝낸다
export const RETIRED_RETENTION_JOB_NAMES = [
  "retention-dispatch",
  "retention-outbox-relay",
] as const;

const RETENTION_RETRY = {
  retryLimit: 4,
  retryDelaySeconds: 1,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

const RetentionJobSchema = z.union([
  z.strictObject({
    name: z.literal(RetentionJobName.STAGE_SWEEP),
    data: z.strictObject({}),
  }),
  z.object({
    name: z.enum(RETIRED_RETENTION_JOB_NAMES),
    data: z.unknown(),
  }),
]);

// 매분 돈다. 5분 간격이면 현지 20:55~20:59에 때가 된 단계가 21:00 실행으로 밀려 야간 방해 금지로 건너뛰어진다.
// 후보는 시각 구간이 아니라 SCHEDULED 상태로 고르므로 늦거나 놓친 실행 뒤에도 지난 단계를 모두 처리한다
export const RETENTION_QUEUE = defineQueue({
  name: "retention.v1",
  payloadSchema: RetentionJobSchema,
  retry: RETENTION_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
  schedules: [
    {
      key: "retention-stage-sweep-scheduler",
      cron: "* * * * *",
      timezone: "UTC",
      missed: "once",
      payload: { name: RetentionJobName.STAGE_SWEEP, data: {} },
    },
  ],
});
