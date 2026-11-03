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

export interface PushReceiptCheckWindow {
  readonly acceptedAfter: Date;
  readonly acceptedBefore: Date;
  readonly checkedBefore: Date;
}

export function pushReceiptCheckWindow(now: Date): PushReceiptCheckWindow {
  const nowMs = now.getTime();
  return {
    acceptedAfter: new Date(nowMs - PUSH_RECEIPT_POLICY.availabilityWindowMs),
    acceptedBefore: new Date(nowMs - PUSH_RECEIPT_POLICY.firstCheckDelayMs),
    checkedBefore: new Date(nowMs - PUSH_RECEIPT_POLICY.recheckIntervalMs),
  };
}
