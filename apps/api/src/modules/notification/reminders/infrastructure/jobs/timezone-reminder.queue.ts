import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

export const TimezoneReminderJobName = {
  SWEEP_REMINDERS: "sweep-reminders",
  REMINDER_HOUR_CHANGED: "reminder-hour-changed",
  SOCIAL_DIGEST: "social-digest",
} as const;

const DAY_SECONDS = 24 * 60 * 60;

const TIMEZONE_REMINDER_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const satisfies JobRetryPolicy;

const ReminderHourChangedJobDataSchema = z.object({
  userId: z.string().min(1),
  timezone: z.string().min(1),
  morningReminderHour: z.number().int().optional(),
  morningReminderMinute: z.number().int().optional(),
  eveningReminderHour: z.number().int().optional(),
  eveningReminderMinute: z.number().int().optional(),
});

const SocialDigestJobDataSchema = z.object({
  timezone: z.string().min(1),
  recipientUserIds: z.array(z.string().min(1)).optional(),
});

export const TimezoneReminderRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(TimezoneReminderJobName.SWEEP_REMINDERS),
    data: z.object({}),
  }),
  z.object({
    name: z.literal(TimezoneReminderJobName.REMINDER_HOUR_CHANGED),
    data: ReminderHourChangedJobDataSchema,
  }),
  z.object({
    name: z.literal(TimezoneReminderJobName.SOCIAL_DIGEST),
    data: SocialDigestJobDataSchema,
  }),
]);

export type TimezoneReminderRuntimeJob = z.output<typeof TimezoneReminderRuntimeJobSchema>;

// 놓친 분은 마지막으로 끝낸 분(ScheduledSweepCursor)부터 sweep이 따라잡으므로 놓친 실행은 하나만 보낸다
export const TIMEZONE_REMINDER_QUEUE = defineQueue({
  name: "timezone-reminder.v1",
  payloadSchema: TimezoneReminderRuntimeJobSchema,
  retry: TIMEZONE_REMINDER_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
  schedules: [
    {
      key: "tz-reminder-sweep-scheduler",
      cron: "* * * * *",
      timezone: "Asia/Seoul",
      missed: "once",
      payload: { name: TimezoneReminderJobName.SWEEP_REMINDERS, data: {} },
    },
  ],
});
