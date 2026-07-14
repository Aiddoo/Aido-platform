/**
 * 푸시 발송 Rate Limiter 인터페이스
 *
 * 사용자별 푸시 발송 빈도를 제한합니다.
 * Redis 또는 인메모리 어댑터로 구현됩니다.
 */
export const PUSH_RATE_LIMITER = Symbol("PUSH_RATE_LIMITER");

export interface IPushRateLimiter {
	/**
	 * 사용자의 푸시 발송 빈도가 제한을 초과했는지 확인
	 *
	 * 제한 미초과 시 카운터를 증가시킵니다 (check-and-increment).
	 *
	 * @returns true이면 제한 초과 (푸시 발송 차단)
	 */
	isRateLimited(userId: string): Promise<boolean>;

	/** 자동 참여 유도 푸시: 사용자 현지 날짜 기준 2회/일, 최소 4시간 간격 */
	isEngagementRateLimited(userId: string, localDate: string): Promise<boolean>;

	/** 리소스 정리 (lifecycle) */
	destroy?(): void;
}
