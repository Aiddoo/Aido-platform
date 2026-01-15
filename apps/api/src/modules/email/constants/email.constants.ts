/**
 * 이메일 서비스 상수
 */
export const EMAIL_CONSTANTS = {
	/** 최대 재시도 횟수 */
	MAX_RETRIES: 3,
	/** 재시도 간 기본 대기 시간 (ms) */
	BASE_RETRY_DELAY: 1000,
	/** 재시도 가능한 에러 타입 */
	RETRYABLE_ERROR_TYPES: ["application_error", "rate_limit_exceeded"] as const,
} as const;

/**
 * 재시도 가능한 에러 타입
 */
export type RetryableErrorType =
	(typeof EMAIL_CONSTANTS.RETRYABLE_ERROR_TYPES)[number];
