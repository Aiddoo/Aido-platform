/**
 * 푸시 발송 Rate Limiter 인터페이스
 *
 * 사용자별 푸시 발송 빈도를 제한합니다.
 * PostgreSQL, Redis/Valkey 또는 인메모리 어댑터로 구현됩니다.
 */
export const PUSH_RATE_LIMITER = Symbol("PUSH_RATE_LIMITER");

export interface GeneralPushRateLimitRequest {
	readonly dispatchId: number;
	readonly userId: string;
}

export interface EngagementPushRateLimitRequest extends GeneralPushRateLimitRequest {
	/** 사용자 현지 날짜(YYYY-MM-DD). */
	readonly localDate: string;
}

export interface PushRateLimitRequest extends GeneralPushRateLimitRequest {
	/** 자동 참여 유도 푸시일 때만 사용자 현지 날짜(YYYY-MM-DD)를 전달합니다. */
	readonly engagementLocalDate?: string;
}

export interface PushRateLimiterPort {
	/**
	 * 사용자의 푸시 발송 빈도가 제한을 초과했는지 확인
	 *
	 * 제한 미초과 시 카운터를 증가시킵니다 (check-and-increment).
	 *
	 * @returns true이면 제한 초과 (푸시 발송 차단)
	 */
	reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean>;

	/** 자동 참여 유도 푸시: 사용자 현지 날짜 기준 2회/일, 최소 4시간 간격 */
	reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean>;

	/**
	 * 배치 발송 자격을 한 번에 예약합니다.
	 * 반환 배열은 입력 순서를 보존하며 true는 제한 초과를 의미합니다.
	 */
	reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]>;

	/** 리소스 정리 (lifecycle) */
	destroy?(): void;
}
