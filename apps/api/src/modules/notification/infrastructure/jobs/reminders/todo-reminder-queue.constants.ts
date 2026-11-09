import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const TODO_REMINDER_QUEUE = "todo-reminder.v1";
export const TODO_REMINDER_JOB_NAME = "send-reminder";

const reminderJobDataSchema = z.object({
  todoId: z.number(),
  userId: z.string(),
  stageLabel: z.string(),
});

export const TODO_SERIES_PAUSED_JOB_NAME = "send-series-paused-notice";

/** 휴면이 시작될 때 한 번 보내는 안내. 옛 서버는 모르는 이름이라 경고만 남기고 버린다. */
export const todoReminderJobSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal(TODO_REMINDER_JOB_NAME), data: reminderJobDataSchema }),
  z.object({
    name: z.literal(TODO_SERIES_PAUSED_JOB_NAME),
    data: z.object({ todoId: z.number(), userId: z.string() }),
  }),
]);

export type ReminderJobData = z.infer<typeof reminderJobDataSchema>;

export const TODO_REMINDER_JOB_POLICY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const;

/**
 * 멈춘 리마인더는 휴면 시작 뒤에도 커서가 앞서 있던 만큼(최대 90일 남짓) 계속 돌아온다.
 * 같은 key의 등록이 무시되도록 그 기간 동안 끝난 행을 남겨 휴면 기간당 한 번만 보낸다.
 */
export const TODO_SERIES_PAUSED_JOB_POLICY = {
  ...TODO_REMINDER_JOB_POLICY,
  deleteAfterSeconds: 120 * 24 * 60 * 60,
} as const;

export const TODO_REMINDER_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;
