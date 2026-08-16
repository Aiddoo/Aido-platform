/**
 * Timezone Reminder BullMQ 큐 상수 및 잡 타입 정의 (인프라).
 *
 * 잡 페이로드 계약은 application 포트가 소유하고, 여기서는 BullMQ 큐/잡 이름과
 * 프로세서용 판별 유니온(discriminated union)만 정의한다.
 */
import { z } from "zod";

import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

import type {
	ReminderHourChangedJobData,
	SocialDigestJobData,
} from "../../application/ports/timezone-reminder-enqueuer.port";

export type {
	ReminderHourChangedJobData,
	SocialDigestJobData,
} from "../../application/ports/timezone-reminder-enqueuer.port";

// =============================================================================
// Queue / Job Names
// =============================================================================

export const TIMEZONE_REMINDER_QUEUE = "timezone-reminder.v1";
export const TIMEZONE_REMINDER_LEGACY_QUEUE = "timezone-reminder";

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

/** 모든 잡 데이터 유니온 타입 (Queue<T> 제네릭용) */
export type TimezoneReminderJobData =
	| ReminderHourChangedJobData
	| SweepRemindersJobData
	| SocialDigestJobData;

/**
 * 잡 이름 → 페이로드 매핑.
 *
 * 프로세서의 `switch(job.name)`가 job.data를 캐스트 없이 좁히도록 하는 판별 키.
 */
export interface TimezoneReminderJobMap {
	"sweep-reminders": SweepRemindersJobData;
	"reminder-hour-changed": ReminderHourChangedJobData;
	"social-digest": SocialDigestJobData;
}

/** 이름으로 판별되는 잡 유니온 (프로세서 진입 타입) */
