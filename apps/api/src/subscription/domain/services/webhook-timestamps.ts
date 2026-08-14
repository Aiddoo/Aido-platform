import { ErrorCode } from "@aido/errors";
import type { RevenueCatWebhookPayload } from "@aido/validators";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

/**
 * RevenueCat 웹훅 타임스탬프 추출 도메인 서비스.
 *
 * 필수 타임스탬프 누락은 SUBSCRIPTION_1604(웹훅 처리 실패)로 정규화한다.
 * reason 문자열은 이벤트 타입이 아닌 호출부에서 명시한다
 * (NON_RENEWING_PURCHASE가 INITIAL_PURCHASE 핸들러를 재사용하며 reason에 "INITIAL_PURCHASE"를 하드코딩하는
 * 기존 동작을 byte-identical하게 보존하기 위함).
 */

/** 필수 purchased_at_ms → Date. 누락 시 SUBSCRIPTION_1604. */
export function requirePurchasedAt(event: RevenueCatEvent, reason: string): Date {
	if (!event.purchased_at_ms) {
		throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
			reason,
			eventType: event.type,
		});
	}
	return new Date(event.purchased_at_ms);
}

/** 필수 expiration_at_ms → Date. 누락 시 SUBSCRIPTION_1604. */
export function requireExpiresAt(event: RevenueCatEvent, reason: string): Date {
	if (!event.expiration_at_ms) {
		throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
			reason,
			eventType: event.type,
		});
	}
	return new Date(event.expiration_at_ms);
}

/** 선택 expiration_at_ms → Date | undefined. */
export function optionalExpiresAt(event: RevenueCatEvent): Date | undefined {
	return event.expiration_at_ms ? new Date(event.expiration_at_ms) : undefined;
}

/** 선택 expiration_at_ms → Date | null (fallback 로직용). */
export function nullableExpiresAt(event: RevenueCatEvent): Date | null {
	return event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
}
