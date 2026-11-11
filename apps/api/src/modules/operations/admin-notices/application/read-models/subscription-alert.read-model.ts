import type {
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";

import type { NoticeEndReason, NoticeStore } from "./admin-notice.read-model.js";

// 관리자 알림이 구독 이벤트에서 읽는 값이다. billing이 같은 모양으로 넘기고, billing의 값이 늘면 호출 쪽 컴파일이 가리킨다
const SUBSCRIPTION_ALERT_KINDS = [
  "STARTED",
  "RENEWED",
  "CANCELLED",
  "UNCANCELLED",
  "EXPIRED",
  "REFUNDED",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE_SCHEDULED",
  "EXTENDED",
  "TRANSFERRED",
] as const;

export type SubscriptionAlertKind = (typeof SUBSCRIPTION_ALERT_KINDS)[number];

const SUBSCRIPTION_ALERT_LIFECYCLES = [
  "trial_started",
  "trial_cancelled",
  "trial_converted",
  "trial_expired",
] as const;

export type SubscriptionAlertLifecycle = (typeof SUBSCRIPTION_ALERT_LIFECYCLES)[number];

/** 결제 채널 구독 알림 입력. 부가 필드는 없으면 알림에서 "—"로 표시하거나 생략한다. */
export interface SubscriptionAlertInput {
  readonly userId: string;
  readonly email: string;
  readonly name?: string;
  readonly kind: SubscriptionAlertKind;
  /** 기간 없는 일회성 구매(STARTED만) */
  readonly isOneTime?: boolean;
  readonly productId: string;
  readonly planType?: SubscriptionPlanType;
  readonly store: NoticeStore | null;
  readonly environment?: SubscriptionEnvironment;
  readonly storeSubscriptionId?: string;
  readonly purchasedAt?: string;
  readonly expiresAt?: string;
  readonly gracePeriodEndsAt?: string;
  readonly endReason?: NoticeEndReason;
  readonly priceUsd?: number;
  readonly priceInPurchasedCurrency?: number;
  readonly purchasedCurrency?: string;
  readonly newProductId?: string;
  readonly newPlanType?: SubscriptionPlanType;
  readonly transfer?: { readonly from: readonly string[]; readonly to: readonly string[] };
  /** 공급자 고객 화면 주소 */
  readonly providerCustomerUrl?: string;
  /** 공급자 이벤트 ID. 알림 작업 멱등 key로 쓴다 */
  readonly eventId?: string;
  readonly countryCode?: string;
  readonly periodKind?: StorePeriodType;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  /** 무료 체험 단계(시작·해지·전환·종료). 체험과 관계없는 이벤트는 비운다 */
  readonly lifecycle?: SubscriptionAlertLifecycle;
  readonly isFirstPurchase?: boolean;
  /** 이 이벤트를 반영한 뒤의 프리미엄 상태 */
  readonly premium?: {
    readonly source: PremiumSource | null;
    readonly periodEndsAt: string | null;
    readonly bankedDays: number;
    readonly isTrial: boolean;
  };
}
