/**
 * 구독 이벤트 알림 페이로드. 구독 상태를 바꾼 뒤 운영 알림(결제 채널)으로 넘긴다. 공급자 이름을 모른다.
 */

import type {
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";

import type { SubscriptionLifecycle } from "../../domain/subscription-lifecycle.domain-service.js";
import type {
  StoreSubscriptionEventKind,
  SubscriptionEndReason,
  SubscriptionStore,
} from "../../domain/subscriptions.constants.js";

/**
 * 공급자 웹훅이 준 값은 이벤트마다 같은 이름으로 싣는다. 이벤트에 없으면 비운다.
 */
export interface SubscriptionEventPayload {
  userId: string;
  email: string;
  name?: string;
  kind: Exclude<StoreSubscriptionEventKind, "IGNORED">;
  /** 기간 없는 일회성 구매(STARTED만) */
  isOneTime?: boolean;
  productId: string;
  /** 상품 ID로 정한 요금제. 모르는 상품·이전 이벤트는 비운다. */
  planType?: SubscriptionPlanType;
  store: SubscriptionStore | null;
  /** 결제 환경. SANDBOX는 테스트 결제라 관리자 알림에 표시하고 매출로 보지 않는다. */
  environment?: SubscriptionEnvironment;
  storeSubscriptionId?: string;
  /** 이번 거래를 산 시각(구매·갱신) */
  purchasedAt?: string;
  /** 지금 기간의 끝. 자동 갱신 중이면 다음 갱신, 해지했으면 이용이 끝나는 시각이다. */
  expiresAt?: string;
  /** 결제 문제 뒤 스토어가 결제를 다시 시도하는 유예의 끝(BILLING_ISSUE만) */
  gracePeriodEndsAt?: string;
  endReason?: SubscriptionEndReason;
  /** 공급자가 USD로 환산한 금액 */
  priceUsd?: number;
  /** 사용자가 낸 통화의 금액 */
  priceInPurchasedCurrency?: number;
  purchasedCurrency?: string;
  /** 다음 갱신에 적용될 상품(PRODUCT_CHANGE_SCHEDULED만) */
  newProductId?: string;
  newPlanType?: SubscriptionPlanType;
  /** 구매를 넘겨준·넘겨받은 앱 사용자 ID(TRANSFERRED만) */
  transfer?: SubscriptionTransfer;
  /** 앱 사용자 ID. 알림 어댑터가 공급자 고객 화면 주소를 만들 때만 쓰고 운영 알림에는 싣지 않는다. */
  appUserId?: string;
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
  /** 이 이벤트를 반영한 뒤의 프리미엄 상태. 구독 행을 바꾸지 않은 이벤트는 비운다. */
  premium?: PremiumAccessSummary;
}

interface SubscriptionTransfer {
  readonly from: readonly string[];
  readonly to: readonly string[];
}

export interface PremiumAccessSummary {
  /** 지금 프리미엄의 출처. 프리미엄이 아니면 null이다. */
  readonly source: PremiumSource | null;
  /** 지금 출처 기간의 끝(ISO string). STORE면 스토어 만료, GRANT면 진행 중인 보상 기간의 끝이다. */
  readonly periodEndsAt: string | null;
  /** 지금 기간이 끝나면 이어서 시작할, 쌓아 둔 보상 일수 */
  readonly bankedDays: number;
  /** 스토어 무료 체험 기간인지 */
  readonly isTrial: boolean;
}
