import { subtractMilliseconds } from "@/shared/domain/date/utils/arithmetic";
import { isAfter } from "@/shared/domain/date/utils/compare";

/** 일반 취소 시 clock skew 대응 grace period(60초) */
const GRACE_PERIOD_MS = 60_000;

/**
 * CANCELLATION 이벤트가 환불(즉시 접근 권한 회수)인지 판정한다.
 *
 * RevenueCat은 환불을 별도 이벤트로 보내지 않고 CANCELLATION + cancel_reason으로 구분한다.
 * cancel_reason이 CUSTOMER_SUPPORT이면 환불, 그 외(UNSUBSCRIBE 등)는 일반 취소.
 */
export function isRefundCancellation(cancelReason: string | null | undefined): boolean {
	return cancelReason === "CUSTOMER_SUPPORT";
}

/**
 * 일반 취소(환불 아님) 시 사용자 구독 상태를 도출한다.
 *
 * 만료일이 grace period(60초)를 감안해 아직 미래이면 만료일까지 ACTIVE 유지, 아니면 CANCELLED.
 */
export function resolveCancellationUserStatus(expiresAt: Date | null): "ACTIVE" | "CANCELLED" {
	return expiresAt && isAfter(expiresAt, subtractMilliseconds(GRACE_PERIOD_MS))
		? "ACTIVE"
		: "CANCELLED";
}
