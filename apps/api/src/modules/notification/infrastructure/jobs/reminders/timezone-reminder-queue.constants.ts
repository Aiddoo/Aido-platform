import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const TIMEZONE_REMINDER_QUEUE = "timezone-reminder.v1";

export const TimezoneReminderJobName = {
  SWEEP_REMINDERS: "sweep-reminders",
  REMINDER_HOUR_CHANGED: "reminder-hour-changed",
  SOCIAL_DIGEST: "social-digest",
} as const;

export const TIMEZONE_REMINDER_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;

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

// =============================================================================
// Job Data
// =============================================================================

/** Sweep reminders 잡 데이터 (크론에서 트리거, 데이터 없음) */
export type SweepRemindersJobData = Record<string, never>;

/** 이름으로 판별되는 잡 유니온 (프로세서 진입 타입) */
