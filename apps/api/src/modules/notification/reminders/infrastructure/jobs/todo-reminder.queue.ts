import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

export const TODO_REMINDER_JOB_NAME = "send-reminder";
export const TODO_SERIES_PAUSED_JOB_NAME = "send-series-paused-notice";

const DAY_SECONDS = 24 * 60 * 60;

const reminderJobDataSchema = z.object({
  todoId: z.number(),
  userId: z.string(),
  stageLabel: z.string(),
});

/** 휴면이 시작될 때 한 번 보내는 안내. 옛 서버는 모르는 이름이라 경고만 남기고 버린다. */
export const todoReminderJobSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal(TODO_REMINDER_JOB_NAME), data: reminderJobDataSchema }),
  z.object({
    name: z.literal(TODO_SERIES_PAUSED_JOB_NAME),
    data: z.object({ todoId: z.number(), userId: z.string() }),
  }),
]);

export type TodoReminderRuntimeJob = z.output<typeof todoReminderJobSchema>;
export type ReminderJobData = z.output<typeof reminderJobDataSchema>;

const TODO_REMINDER_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// 멈춘 리마인더는 휴면 시작 뒤에도 커서가 앞서 있던 만큼(최대 90일 남짓) 돌아오므로, 끝난 행을 그만큼 남겨 같은 key 등록을 무시한다
const TODO_SERIES_PAUSED_RETRY = {
  ...TODO_REMINDER_RETRY,
  deleteAfterSeconds: 120 * DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// 폴링(15초)마다 한 건이면 분당 4건이라 같은 분에 몰린 리마인더가 늦음 한도를 넘는다. 가득 찬 묶음이면 쉬지 않고 다음을 꺼낸다.
// 묶음이 작아야 프로세스가 죽을 때 꺼낸 채 만료(10분)를 기다리는 작업이 적다. 반복 멈춤 안내는 다시 실행하면 또 보내므로
// worker는 workBatch로 묶음을 받아 실패한 작업만 돌려준다
export const TODO_REMINDER_QUEUE = defineQueue({
  name: "todo-reminder.v1",
  payloadSchema: todoReminderJobSchema,
  retry: TODO_REMINDER_RETRY,
  worker: {
    localConcurrency: 1,
    pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
    batchSize: 20,
    burstWhenBatchFull: true,
  },
});

// 같은 큐에 작업별 보존 기간만 다르게 넣는다. pg-boss는 작업 행의 deleteAfterSeconds를 큐 기본값보다 먼저 쓴다
export const TODO_SERIES_PAUSED_QUEUE = defineQueue({
  ...TODO_REMINDER_QUEUE,
  retry: TODO_SERIES_PAUSED_RETRY,
});
