import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

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
  /** SANDBOX면 App Review·TestFlight 또는 개발 빌드 구매다. 심각도는 같고 경보에서 구분만 한다. */
  readonly environment?: SubscriptionEnvironment;
  readonly productId?: string;
}

export const SUBSCRIPTION_EVENT_NOTIFIER = Symbol("SUBSCRIPTION_EVENT_NOTIFIER");

export interface SubscriptionEventNotifierPort {
  /** 커밋 뒤 운영 알림을 넘긴다. 알림 실패가 구독 반영을 되돌리지 않도록 기다리지 않고 던지지 않는다. */
  notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
  /**
   * 사용자에게 갈 결제 문제 푸시를 활성 UoW 안에서 기록한다. 처리 원장과 함께 커밋돼야 커밋 뒤 실패로
   * 알림을 잃어도 공급자 재전송이 원장에 막혀 복구되지 않는 일이 없다.
   */
  recordBillingIssue(userId: string, at: Date): Promise<void>;
  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void;
}
