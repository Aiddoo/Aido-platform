import type {
  StoreSubscriptionEventKind,
  SubscriptionStore,
} from "../../../domain/types/subscriptions/store-subscription.types.js";
import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";

/** 처리에 실패한 이벤트. 이전 이벤트는 상품이 없다. */
export interface StoreSubscriptionEventFailureContext {
  readonly kind: StoreSubscriptionEventKind;
  readonly providerEventId?: string;
  readonly store?: SubscriptionStore;
  readonly productId?: string;
}

export const SUBSCRIPTION_EVENT_NOTIFIER = Symbol("SUBSCRIPTION_EVENT_NOTIFIER");

/** 커밋 뒤 관리자 알림·결제 문제 푸시를 등록하고, 처리 실패를 운영 경보로 올린다. 모두 던지지 않는다. */
export interface SubscriptionEventNotifierPort {
  notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
  notifyBillingIssue(userId: string): void;
  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void;
}
