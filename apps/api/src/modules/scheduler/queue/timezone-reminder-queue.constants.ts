/**
 * Timezone Reminder BullMQ 큐 상수 및 잡 데이터 타입 정의
 */

// =============================================================================
// Queue Name
// =============================================================================

export const TIMEZONE_REMINDER_QUEUE = "timezone-reminder";

// =============================================================================
// Job Names
// =============================================================================

export const TimezoneReminderJobName = {
	SWEEP_REMINDERS: "sweep-reminders",
	REMINDER_HOUR_CHANGED: "reminder-hour-changed",
	SOCIAL_DIGEST: "social-digest",
} as const;

// =============================================================================
// Job Data Interfaces
// =============================================================================

/**
 * 리마인더 시간 변경 잡 데이터
 *
 * 사용자가 아침/저녁 리마인더 시간을 변경했을 때 발행됩니다.
 * 변경된 시간이 현재 로컬 시간과 같으면 즉시 리마인더를 보내기 위함.
 */
export interface ReminderHourChangedJobData {
	/** 사용자 ID */
	userId: string;
	/** 사용자 타임존 (IANA) */
	timezone: string;
	/** 변경된 아침 리마인더 시간 (undefined면 변경 안 됨) */
	morningReminderHour?: number;
	/** 변경된 아침 리마인더 분 (undefined면 변경 안 됨) */
	morningReminderMinute?: number;
	/** 변경된 저녁 리마인더 시간 (undefined면 변경 안 됨) */
	eveningReminderHour?: number;
	/** 변경된 저녁 리마인더 분 (undefined면 변경 안 됨) */
	eveningReminderMinute?: number;
}

/**
 * Sweep reminders 잡 데이터 (크론에서 트리거, 데이터 없음)
 */
export type SweepRemindersJobData = Record<string, never>;

/**
 * Social Digest 잡 데이터
 *
 * 저녁 리마인더 발송 30분 후 실행.
 * 본인 미완료 + 친구 완료 시 소셜 압박 알림 발송.
 */
export interface SocialDigestJobData {
	/** 사용자 타임존 (IANA) */
	timezone: string;
}

/** 모든 잡 데이터 유니온 타입 */
export type TimezoneReminderJobData =
	| ReminderHourChangedJobData
	| SweepRemindersJobData
	| SocialDigestJobData;
