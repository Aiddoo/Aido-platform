/**
 * Timezone Reminder BullMQ 큐 상수 및 잡 타입 정의 (인프라).
 *
 * 잡 페이로드 계약은 application 포트가 소유하고, 여기서는 BullMQ 큐/잡 이름과
 * 프로세서용 판별 유니온(discriminated union)만 정의한다.
 */
import type { Job } from "bullmq";

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

export const TIMEZONE_REMINDER_QUEUE = "timezone-reminder";

export const TimezoneReminderJobName = {
	SWEEP_REMINDERS: "sweep-reminders",
	REMINDER_HOUR_CHANGED: "reminder-hour-changed",
	SOCIAL_DIGEST: "social-digest",
} as const;

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
interface TimezoneReminderJobDataByName {
	"sweep-reminders": SweepRemindersJobData;
	"reminder-hour-changed": ReminderHourChangedJobData;
	"social-digest": SocialDigestJobData;
}

/** 이름으로 판별되는 잡 유니온 (프로세서 진입 타입) */
export type TimezoneReminderJob = {
	[K in keyof TimezoneReminderJobDataByName]: Job<
		TimezoneReminderJobDataByName[K],
		unknown,
		K
	>;
}[keyof TimezoneReminderJobDataByName];
