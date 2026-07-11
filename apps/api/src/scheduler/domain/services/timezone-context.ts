/**
 * 타임존 리마인더 실행 컨텍스트 (도메인 값 타입).
 *
 * 오케스트레이터가 매분 스윕에서 각 타임존의 로컬 시각을 계산해 채우고,
 * 각 Strategy는 이 컨텍스트만 받아 발송 여부를 판단한다(프레임워크·DB 비의존).
 */
export interface TimezoneContext {
	/** IANA 타임존 (예: "Asia/Seoul") */
	readonly tz: string;
	/** 로컬 시(0-23) */
	readonly localHour: number;
	/** 로컬 분(0-59) */
	readonly localMinute: number;
	/** 로컬 요일 (0=일, 1=월, ...) */
	readonly dayOfWeek: number;
	/** 로컬 오늘 자정(UTC 인스턴트) */
	readonly today: Date;
	/** 로컬 내일 자정(UTC 인스턴트) */
	readonly tomorrow: Date;
	/** catch-up 발송 시 특정 유저만 대상 (없으면 전체 스윕) */
	readonly userId?: string;
}

/**
 * 모든 타임존 기반 Strategy가 구현하는 공통 인터페이스.
 *
 * 반환값 `sent`는 실제 발송 건수(오케스트레이터가 후속 조건 분기에 사용).
 */
export interface ITimezoneStrategy {
	execute(ctx: TimezoneContext): Promise<{ sent: number }>;
}
