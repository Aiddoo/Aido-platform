const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

/** Queue backend 장애 중에도 outbox를 버리지 않고 capped exponential backoff로 재시도한다. */
export function pushDeliveryOutboxRetryDelayMs(publishAttempt: number): number {
	const exponent = Math.max(0, Math.min(publishAttempt - 1, 6));
	return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS);
}
