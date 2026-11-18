import { clamp } from "es-toolkit";

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

/** Queue backend 장애 중에도 outbox를 버리지 않고 capped exponential backoff로 재시도한다. */
export function pushDeliveryOutboxRetryDelayMs(publishAttempt: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** clamp(publishAttempt - 1, 0, 6), MAX_RETRY_DELAY_MS);
}
