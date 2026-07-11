import { subtractMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import { isAfter } from "@/shared/domain/date/utils/compare";

/** 일반 취소 시 clock skew 대응 grace period(60초) */
const GRACE_PERIOD_MS = 60_000;

/**
 * 일반 취소(환불 아님) 시 사용자 구독 상태를 도출한다.
 *
 * 만료일이 grace period(60초)를 감안해 아직 미래이면 만료일까지 ACTIVE 유지, 아니면 CANCELLED.
 */
export function resolveCancellationUserStatus(
	expiresAt: Date | null,
): "ACTIVE" | "CANCELLED" {
	return expiresAt && isAfter(expiresAt, subtractMilliseconds(GRACE_PERIOD_MS))
		? "ACTIVE"
		: "CANCELLED";
}
