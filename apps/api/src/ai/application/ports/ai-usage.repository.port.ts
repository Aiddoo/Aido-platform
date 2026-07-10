/**
 * AI 사용량 저장소 포트
 *
 * 사용자별 월간 AI 파싱 사용량(카운트·리셋시각)의 읽기/원자적 증감을 추상화한다.
 * 실제 저장소(User 테이블)는 어댑터가 위임하므로, 애플리케이션은 벤더/스키마에
 * 의존하지 않는다. 트랜잭션 경계는 어댑터가 CLS(TransactionHost)에서 읽는다.
 */

/** AI 사용량 스냅샷 (저장소 중립 표현). */
export interface AiUsageSnapshot {
	/** 현재 카운트 */
	count: number;
	/** 마지막 리셋 시각 (없으면 null) */
	resetAt: Date | null;
}

export interface AiUsageRepositoryPort {
	/** 사용량 스냅샷 조회 (없으면 null). */
	findUsage(userId: string): Promise<AiUsageSnapshot | null>;
	/** 카운트 +1. */
	increment(userId: string): Promise<void>;
	/** 카운트를 1로 리셋하고 리셋 시각 갱신 (새로운 달). */
	resetAndIncrement(userId: string): Promise<void>;
	/** 카운트 -1 (0 미만 방지, 트랜잭션 밖 보상 경로). */
	decrement(userId: string): Promise<void>;
}

/** AI 사용량 저장소 주입 토큰. */
export const AI_USAGE_REPOSITORY = Symbol("AI_USAGE_REPOSITORY");
