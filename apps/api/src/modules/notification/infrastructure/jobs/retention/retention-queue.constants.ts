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
