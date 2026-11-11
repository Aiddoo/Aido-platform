import type { SubscriptionEnvironment } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  StoreSubscriptionEventKind,
  SubscriptionStore,
} from "../../domain/subscriptions.constants.js";
import type { SubscriptionEventPayload } from "../read-models/subscription-event-payload.read-model.js";

/** 처리에 실패한 이벤트. 이전 이벤트는 상품이 없다. */
export interface StoreSubscriptionEventFailureContext {
  readonly kind: StoreSubscriptionEventKind;
  readonly providerEventId?: string;
  readonly store?: SubscriptionStore;
  /** SANDBOX면 App Review·TestFlight 또는 개발 빌드 구매다. 심각도는 같고 경보에서 구분만 한다. */
  readonly environment?: SubscriptionEnvironment;
  readonly productId?: string;
}

/**
 * 관리자 알림과 결제 문제 푸시, 웹훅 실패 경보로 나가는 좁은 포트. 운영 알림 Context를 모르는 채
 * 구독 반영 흐름이 필요한 세 가지만 건넨다.
 */
export abstract class SubscriptionEventNotifierPort {
  /** 커밋 뒤 운영 알림을 넘긴다. 알림 실패가 구독 반영을 되돌리지 않도록 기다리지 않고 던지지 않는다. */
  abstract notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
  /**
   * 사용자에게 갈 결제 문제 푸시를 활성 UoW 안에서 기록한다. 처리 원장과 함께 커밋돼야 커밋 뒤 실패로
   * 알림을 잃어도 공급자 재전송이 원장에 막혀 복구되지 않는 일이 없다.
   */
  abstract recordBillingIssue(userId: UserId, at: Temporal.Instant): Promise<void>;
  abstract reportWebhookFailure(
    error: unknown,
    context: StoreSubscriptionEventFailureContext,
  ): void;
}
