/**
 * NudgeLimitReaderPort — 트랜잭션 내 콕 찌르기 일일 한도 조회 포트.
 *
 * 콕 찌르기 전송 경로의 TOCTOU 방지를 위해 활성 트랜잭션 클라이언트로 실시간 한도를 읽는다.
 * 트랜잭션 클라이언트 접근(EntitlementService.getFeatureLimitInTx)은 인프라 어댑터가 캡슐화한다.
 */

export const NUDGE_LIMIT_READER = Symbol("NUDGE_LIMIT_READER");

export interface NudgeLimitReaderPort {
	/** 트랜잭션 내 사용자 일일 콕 찌르기 한도 (null이면 무제한) */
	getDailyLimitInTx(userId: string): Promise<number | null>;
}
