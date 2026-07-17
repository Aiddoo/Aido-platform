/** AI 제안 실패 잡 보존 정책 — 원인 분석을 위해 7일, 메모리 상한은 1,000건 */
export const AI_SUGGESTION_FAILED_JOB_RETENTION = {
	age: 7 * 24 * 60 * 60,
	count: 1_000,
} as const;
