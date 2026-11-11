import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

const TODO_TIMEZONE_REBASE_JOB_NAME = "rebase-todo-timezone";

/**
 * 시간대가 바뀌어도 이만큼 묶어 사용자당 작업 하나만 돈다. 시간대가 다른 기기 두 대가 번갈아 요청해도
 * 이 간격보다 자주 돌지 않고, 환승처럼 잇따라 바뀌면 마지막 값만 계산한다.
 */
export const TODO_TIMEZONE_REBASE_WINDOW_MS = 60_000;

const todoTimezoneRebasePayloadSchema = z.object({
  name: z.literal(TODO_TIMEZONE_REBASE_JOB_NAME),
  data: z.object({ userId: z.string() }),
});

export type TodoTimezoneRebasePayload = z.infer<typeof todoTimezoneRebasePayloadSchema>;

export function toTodoTimezoneRebasePayload(userId: string): TodoTimezoneRebasePayload {
  return { name: TODO_TIMEZONE_REBASE_JOB_NAME, data: { userId } };
}

// 스케줄 없이 설정 쓰기가 넣는 작업만 소비한다
export const TODO_TIMEZONE_REBASE_QUEUE = defineQueue({
  name: "todo-timezone-rebase.v1",
  payloadSchema: todoTimezoneRebasePayloadSchema,
  retry: {
    retryLimit: 3,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
});
