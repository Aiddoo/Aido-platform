const MINUTE_MS = 60_000;

/** 공급자가 정하는 receipt 대기·보관 시간. 값은 푸시 공급자 어댑터가 준다. */
export interface PushReceiptTiming {
  /** 수락한 ticket의 receipt를 처음 물어도 되는 시간 */
  readonly readyAfterMs: number;
  /** 공급자가 receipt를 보관하는 시간. 지나면 결과를 알 수 없다 */
  readonly retentionMs: number;
}

/** 우리가 정하는 확인 주기와 실행 한도다. 공급자 시간은 PushReceiptTiming으로 받는다. */
export const PUSH_RECEIPT_POLICY = {
  recheckIntervalMs: 15 * MINUTE_MS,
  batchSize: 900,
  expireBatchSize: 5000,
  runBudgetMs: 45_000,
} as const;

/**
 * 한 번의 receipt 확인 실행(5분마다, 실행 예산 안)에서 받은 receipt 중 공급자 쪽 실패 비율이 이 값 이상이면 경보한다.
 * 기기 미등록·잘못된 토큰은 앱 삭제로 늘 생기므로 세지 않는다.
 */
const PUSH_RECEIPT_FAILURE_RATIO_THRESHOLD = 0.2;

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

export function pushReceiptCheckWindow(
  now: Temporal.Instant,
  timing: PushReceiptTiming,
): PushReceiptCheckWindow {
  return {
    acceptedAfter: now.subtract({ milliseconds: timing.retentionMs }),
    acceptedBefore: now.subtract({ milliseconds: timing.readyAfterMs }),
    checkedBefore: now.subtract({ milliseconds: PUSH_RECEIPT_POLICY.recheckIntervalMs }),
  };
}
