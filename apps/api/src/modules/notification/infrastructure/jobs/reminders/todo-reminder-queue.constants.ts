import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const TODO_REMINDER_QUEUE = "todo-reminder.v1";
export const TODO_REMINDER_JOB_NAME = "send-reminder";

const reminderJobDataSchema = z.object({
  todoId: z.number(),
  userId: z.string(),
  stageLabel: z.string(),
});

export const todoReminderJobSchema = z.object({
  name: z.literal(TODO_REMINDER_JOB_NAME),
  data: reminderJobDataSchema,
});

export type ReminderJobData = z.infer<typeof reminderJobDataSchema>;

export const TODO_REMINDER_JOB_POLICY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const TODO_REMINDER_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;
