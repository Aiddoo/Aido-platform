/**
 * 타임존 리마인더 큐 enqueue 포트.
 *
 * 오케스트레이터(social digest 지연 잡·스윕 스케줄러 등록)와
 * 외부 모듈(리마인더 시간 변경 catch-up)의 큐 발송 진입점을 추상화한다.
 * 구현은 인프라의 BullMQ 큐 서비스가 담당한다.
 */

export const TIMEZONE_REMINDER_ENQUEUER = Symbol("TIMEZONE_REMINDER_ENQUEUER");

/**
 * 리마인더 시간 변경 잡 데이터.
 *
 * 사용자가 아침/저녁 리마인더 시간을 변경했을 때 발행된다.
 * 변경된 시간이 현재 로컬 시간과 같으면 즉시 리마인더를 보내기 위함.
 */
export interface ReminderHourChangedJobData {
	/** 사용자 ID */
	readonly userId: string;
	/** 사용자 타임존 (IANA) */
	readonly timezone: string;
	/** 변경된 아침 리마인더 시간 (undefined면 변경 안 됨) */
	readonly morningReminderHour?: number;
	/** 변경된 아침 리마인더 분 (undefined면 변경 안 됨) */
	readonly morningReminderMinute?: number;
	/** 변경된 저녁 리마인더 시간 (undefined면 변경 안 됨) */
	readonly eveningReminderHour?: number;
	/** 변경된 저녁 리마인더 분 (undefined면 변경 안 됨) */
	readonly eveningReminderMinute?: number;
}

/**
 * Social Digest 잡 데이터.
 *
 * 저녁 리마인더 발송 90분 후 실행. 본인 미완료 + 친구 완료 시 활동 요약 알림 발송.
 */
export interface SocialDigestJobData {
	/** 사용자 타임존 (IANA) */
	readonly timezone: string;
}

export interface TimezoneReminderEnqueuerPort {
	/** 매분 sweep 스케줄러 등록 (upsert — 멱등) */
	registerSweepScheduler(): Promise<void>;

	/** 리마인더 시간 변경 catch-up 잡 등록 (fire-and-forget) */
	enqueueReminderHourChanged(payload: ReminderHourChangedJobData): void;

	/** Social Digest 지연 잡 등록 (저녁 리마인더 90분 후, fire-and-forget) */
	enqueueSocialDigest(payload: SocialDigestJobData): void;
}
