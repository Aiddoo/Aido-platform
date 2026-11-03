import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const RETENTION_QUEUE = "retention.v1";

export const RetentionJobName = {
  STAGE_SWEEP: "retention-stage-sweep",
} as const;

export const RETENTION_STAGE_SWEEP_SCHEDULE = {
  key: "retention-stage-sweep-scheduler",
  cron: "* * * * *",
} as const;

/**
 * @deprecated 발송이 공용 push-delivery.v1으로 옮겨져 더 쓰지 않는 예약이다.
 * TODO: 1.14.1 배포 뒤 pg-boss 예약 목록에 이 key가 없으면 상수와 해제 호출을 지운다.
 */
export const RETIRED_RETENTION_OUTBOX_RELAY_SCHEDULE_KEY = "retention-outbox-relay-scheduler";

export const RETENTION_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;

export const RETENTION_JOB_POLICY = {
  retryLimit: 4,
  retryDelaySeconds: 1,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const RetentionRuntimeJobSchema = z.discriminatedUnion("name", [
  z.strictObject({
    name: z.literal(RetentionJobName.STAGE_SWEEP),
    data: z.strictObject({}),
  }),
]);
