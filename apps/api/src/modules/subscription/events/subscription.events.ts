/**
 * 구독 이벤트 페이로드 정의
 *
 * RevenueCat 웹훅으로부터 수신되는 구독 관련 이벤트 페이로드.
 * SubscriptionService 및 AdminNotificationQueueService에서 사용됩니다.
 */

import type { RevenueCatEventType, RevenueCatStore } from "@aido/validators";

/**
 * 구독 이벤트 페이로드
 */
export interface SubscriptionEventPayload {
	/** 사용자 ID */
	userId: string;
	/** 이메일 */
	email: string;
	/** 이벤트 타입 (RevenueCat 원본 이벤트명) */
	eventType: RevenueCatEventType;
	/** 상품 ID */
	productId: string;
	/** 스토어 (APP_STORE / PLAY_STORE / STRIPE 등) */
	store?: RevenueCatStore;
	/** 트랜잭션 ID */
	transactionId?: string;
	/** 구매 시각 (ISO string) */
	purchasedAt?: string;
	/** 만료 시각 (ISO string) */
	expiresAt?: string;
	/** 취소 사유 */
	cancelReason?: string;
	/** 가격 */
	price?: number;
	/** 통화 코드 (KRW, USD 등) */
	currency?: string;
}
