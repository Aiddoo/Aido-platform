/**
 * 타임존 리마인더 Strategy 인터페이스
 *
 * 각 알림 유형(아침/저녁/주간 등)을 독립적인 Strategy로 분리하여
 * 오케스트레이터(TimezoneAwareReminderJob)가 위임합니다.
 */

export interface TimezoneContext {
	tz: string;
	localHour: number;
	localMinute: number;
	dayOfWeek: number; // 0=일, 1=월, ...
	today: Date;
	tomorrow: Date;
	/** catch-up 발송 시 특정 유저만 대상 */
	userId?: string;
}

/** 모든 타임존 기반 Strategy가 구현하는 공통 인터페이스 */
export interface ITimezoneStrategy {
	execute(ctx: TimezoneContext): Promise<{ sent: number }>;
}
