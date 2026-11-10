const MINUTE_MS = 60_000;

/** Expo는 ticket 수락 뒤 receipt를 약 24시간 보관한다. 그 뒤에는 결과를 알 수 없다. */
export const PUSH_RECEIPT_POLICY = {
  firstCheckDelayMs: 15 * MINUTE_MS,
  recheckIntervalMs: 15 * MINUTE_MS,
  availabilityWindowMs: 24 * 60 * MINUTE_MS,
  batchSize: 900,
  expireBatchSize: 5_000,
  runBudgetMs: 45_000,
} as const;

/**
 * 한 번의 receipt 확인 실행(5분마다, 실행 예산 안)에서 받은 receipt 중 공급자 쪽 실패 비율이 이 값 이상이면 경보한다.
 * 기기 미등록·잘못된 토큰은 앱 삭제로 늘 생기므로 세지 않는다.
 */
export const PUSH_RECEIPT_FAILURE_RATIO_THRESHOLD = 0.2;

/** 받은 receipt가 이보다 적으면 한두 건으로 비율이 튀므로 판정하지 않는다 */
export const PUSH_RECEIPT_FAILURE_MIN_RECEIPTS = 20;

export function isReceiptFailureRatioHigh(input: {
  readonly receivedCount: number;
  readonly providerFailureCount: number;
}): boolean {
  return (
    input.receivedCount >= PUSH_RECEIPT_FAILURE_MIN_RECEIPTS &&
    input.providerFailureCount / input.receivedCount >= PUSH_RECEIPT_FAILURE_RATIO_THRESHOLD
  );
}

export interface PushReceiptCheckWindow {
  readonly acceptedAfter: Temporal.Instant;
  readonly acceptedBefore: Temporal.Instant;
  readonly checkedBefore: Temporal.Instant;
}

export function pushReceiptCheckWindow(now: Temporal.Instant): PushReceiptCheckWindow {
  return {
    acceptedAfter: now.subtract({ milliseconds: PUSH_RECEIPT_POLICY.availabilityWindowMs }),
    acceptedBefore: now.subtract({ milliseconds: PUSH_RECEIPT_POLICY.firstCheckDelayMs }),
    checkedBefore: now.subtract({ milliseconds: PUSH_RECEIPT_POLICY.recheckIntervalMs }),
  };
}
