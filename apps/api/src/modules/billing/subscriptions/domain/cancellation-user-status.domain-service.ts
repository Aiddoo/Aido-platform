import type { SubscriptionStatus } from "@aido/api/vocabulary";

/** 일반 취소 시 clock skew 대응 grace period(60초) */
const CANCELLATION_CLOCK_SKEW_MS = 60_000;

/**
 * 일반 취소(환불 아님) 시 사용자 구독 상태를 도출한다.
 *
 * 만료일이 grace period(60초)를 감안해 아직 미래이면 만료일까지 ACTIVE 유지, 아니면 CANCELLED.
 */
export function resolveCancellationUserStatus(
  expiresAt: Temporal.Instant | null,
  now: Temporal.Instant,
): Extract<SubscriptionStatus, "ACTIVE" | "CANCELLED"> {
  return expiresAt != null &&
    Temporal.Instant.compare(
      expiresAt,
      now.subtract({ milliseconds: CANCELLATION_CLOCK_SKEW_MS }),
    ) > 0
    ? "ACTIVE"
    : "CANCELLED";
}
