import type { RevenueCatWebhookPayload } from "@aido/validators";

import type { SubscriptionEventPayload } from "../../../domain/events/subscription-event.payload";
import type { SubscriptionUser } from "../../ports/subscription.repository.port";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

/**
 * 모든 구독 이벤트 페이로드의 공통 필드를 조립한다.
 *
 * transactionId는 대부분의 이벤트에 포함되나 TRANSFER는 생략한다
 * (transactionId 인자를 넘기지 않으면 키 자체가 빠지는 기존 동작을 보존).
 * 이벤트별 추가 필드(purchasedAt·expiresAt·가격·cancelReason 등)는 호출부에서 spread로 덧붙인다.
 */
export function baseEventPayload(
	user: SubscriptionUser,
	event: RevenueCatEvent,
	transactionId?: string,
): SubscriptionEventPayload {
	return {
		userId: user.id,
		email: user.email,
		name: user.profile?.name ?? undefined,
		eventType: event.type,
		productId: event.product_id,
		store: event.store,
		...(transactionId !== undefined && { transactionId }),
	};
}
