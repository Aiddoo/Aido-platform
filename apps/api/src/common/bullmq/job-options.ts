/**
 * AI per-user 잡 공통 옵션
 *
 * Gemini API 호출을 포함하는 잡용:
 * - 5초 exponential backoff (API rate limit 대응)
 * - 완료 잡 7일 보관 (jobId 기반 dedup 유지)
 */
export const AI_PER_USER_JOB_OPTS = {
	attempts: 3,
	backoff: { type: "exponential" as const, delay: 5_000 },
	removeOnComplete: { age: 604_800, count: 10_000 },
	removeOnFail: { count: 100, age: 86_400 },
} as const;
