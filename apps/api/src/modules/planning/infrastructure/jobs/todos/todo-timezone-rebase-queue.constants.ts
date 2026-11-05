import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const TODO_TIMEZONE_REBASE_QUEUE = "todo-timezone-rebase.v1";
export const TODO_TIMEZONE_REBASE_JOB_NAME = "rebase-todo-timezone";

/**
 * 시간대가 바뀌어도 이만큼 묶어 사용자당 작업 하나만 돈다. 시간대가 다른 기기 두 대가 번갈아 요청해도
 * 이 간격보다 자주 돌지 않고, 환승처럼 잇따라 바뀌면 마지막 값만 계산한다.
 */
export const TODO_TIMEZONE_REBASE_WINDOW_MS = 60_000;

export const todoTimezoneRebaseJobSchema = z.object({
  name: z.literal(TODO_TIMEZONE_REBASE_JOB_NAME),
  data: z.object({ userId: z.string() }),
});

export const TODO_TIMEZONE_REBASE_JOB_POLICY = {
  retryLimit: 3,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const satisfies EnqueueJobOptions;

export const TODO_TIMEZONE_REBASE_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;
