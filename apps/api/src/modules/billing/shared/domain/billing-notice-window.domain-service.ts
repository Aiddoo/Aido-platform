const DAY_MS = 24 * 60 * 60 * 1000;

/** 이 시각 이전에 끝나는 기간을 지금 안내한다. 결제·보상 기간 안내의 하루는 UTC 24시간이다. */
export function billingNoticeUntil(now: Temporal.Instant, days: number): Temporal.Instant {
  return now.add({ milliseconds: days * DAY_MS });
}

/** 시작할 때 이미 안내 기간 안이었던 기간(재설치·짧은 체험)은 시작 직후 알림이 되므로 보내지 않는다. */
export function isBillingNoticeable(
  startedAt: Temporal.Instant,
  endsAt: Temporal.Instant,
  days: number,
): boolean {
  return Temporal.Instant.compare(endsAt, billingNoticeUntil(startedAt, days)) > 0;
}
