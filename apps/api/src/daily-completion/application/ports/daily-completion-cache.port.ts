import type { DailyCompletionsRange } from "../../domain/daily-completion";

/** DailyCompletionCachePort DI 토큰 */
export const DAILY_COMPLETION_CACHE = Symbol("DAILY_COMPLETION_CACHE");

/**
 * 일별 완료 현황 캐시 포트 (cache 인프라 경계)
 *
 * 날짜 세그먼트(startDate/endDate)는 호출 측이 정규화한 YYYY-MM-DD 문자열이다.
 * 키 스킴·TTL은 인프라 어댑터(중앙 CacheKeys)가 소유한다.
 */
export interface DailyCompletionCachePort {
	getRange(
		userId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange | undefined>;

	setRange(
		userId: string,
		startDate: string,
		endDate: string,
		value: DailyCompletionsRange,
	): Promise<void>;

	/** 친구에게 보이는 공개(PUBLIC) 범위 캐시 — 키는 소유자 기준이라 뷰어 무관 공유. */
	getPublicRange(
		ownerUserId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange | undefined>;

	setPublicRange(
		ownerUserId: string,
		startDate: string,
		endDate: string,
		value: DailyCompletionsRange,
	): Promise<void>;

	/** 해당 사용자의 모든 범위 캐시(공개 범위 포함)를 무효화한다. */
	invalidate(userId: string): Promise<void>;
}
