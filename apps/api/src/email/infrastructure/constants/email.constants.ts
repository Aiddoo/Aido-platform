/**
 * 이메일 전송(Resend) 트랜스포트 상수
 */
export const EMAIL_CONSTANTS = {
	/** 최대 재시도 횟수 */
	MAX_RETRIES: 3,
	/** 재시도 간 기본 대기 시간 (ms) */
	BASE_RETRY_DELAY: 1000,
} as const;

/** 재시도 가능한 Resend 에러 타입 (Set으로 타입 단언 없이 조회) */
export const RETRYABLE_ERROR_TYPES: ReadonlySet<string> = new Set([
	"application_error",
	"rate_limit_exceeded",
]);
