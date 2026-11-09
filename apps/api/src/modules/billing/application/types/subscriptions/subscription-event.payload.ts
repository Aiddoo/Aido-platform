/**
 * 구독 이벤트 알림 페이로드. 구독 상태를 바꾼 뒤 운영 알림(결제 채널)으로 넘긴다. 공급자 이름을 모른다.
 */

import type { StorePeriodType, SubscriptionEnvironment } from "@aido/api/vocabulary";

import type { SubscriptionLifecycle } from "../../../domain/policies/subscriptions/subscription-lifecycle.policy.js";
import type {
  StoreSubscriptionEventKind,
  SubscriptionEndReason,
  SubscriptionStore,
} from "../../../domain/types/subscriptions/store-subscription.types.js";

export type { SubscriptionLifecycle };

export interface SubscriptionEventPayload {
  userId: string;
  email: string;
  name?: string;
  kind: Exclude<StoreSubscriptionEventKind, "IGNORED">;
  /** 기간 없는 일회성 구매(STARTED만) */
  isOneTime?: boolean;
  productId: string;
  store: SubscriptionStore | null;
  /** 결제 환경. SANDBOX는 테스트 결제라 관리자 알림에 표시하고 매출로 보지 않는다. */
  environment?: SubscriptionEnvironment;
  storeSubscriptionId?: string;
  purchasedAt?: string;
  expiresAt?: string;
  endReason?: SubscriptionEndReason;
  priceUsd?: number;
  priceInPurchasedCurrency?: number;
  purchasedCurrency?: string;
  /** 앱 사용자 ID. 운영 알림의 공급자 고객 화면 링크에 쓴다. */
  appUserId?: string;
  /** 공급자 고객 화면 주소. 알림 어댑터가 설정이 있을 때만 채운다. */
  providerCustomerUrl?: string;
  /** 공급자 이벤트 ID. 알림 잡 멱등 키로 쓴다. */
  eventId?: string;
  countryCode?: string;
  periodKind?: StorePeriodType;
  appVersion?: string;
  deviceModel?: string;
  /** 무료 체험 단계(시작·해지·전환·종료). 체험과 관계없는 이벤트는 비운다. */
  lifecycle?: SubscriptionLifecycle;
  /** 이 사용자의 첫 스토어 구매인지(구매 이벤트만) */
  isFirstPurchase?: boolean;
  /** 이 이벤트로 다시 계산한 보상 기간 상태. 쌓아 둔 보상이 있거나 보상 기간이 이어질 때만 있다. */
  premiumGrantImpact?: PremiumGrantImpact;
}

export interface PremiumGrantImpact {
  /** 스토어 구독 뒤로 쌓아 둔 보상 일수 */
  readonly bankedDays: number;
  /** 스토어가 끝나 보상 기간이 이어졌으면 그 기간의 끝(ISO string). 아니면 null이다. */
  readonly grantPeriodEndsAt: string | null;
}
