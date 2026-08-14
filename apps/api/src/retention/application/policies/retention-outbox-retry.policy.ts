const OUTBOX_RETRY_BASE_DELAY_MS = 1_000;
const OUTBOX_RETRY_MAX_DELAY_MS = 15 * 60_000;
const OUTBOX_MAX_ATTEMPTS = 20;

/** 내구성 outbox의 지수 백오프와 종료 조건을 한곳에서 결정한다. */
export function decideRetentionOutboxRetry(attempts: number): {
	readonly delayMs: number;
	readonly hasExhaustedRetries: boolean;
} {
	return {
		delayMs: Math.min(OUTBOX_RETRY_MAX_DELAY_MS, OUTBOX_RETRY_BASE_DELAY_MS * 2 ** attempts),
		hasExhaustedRetries: attempts >= OUTBOX_MAX_ATTEMPTS,
	};
}
