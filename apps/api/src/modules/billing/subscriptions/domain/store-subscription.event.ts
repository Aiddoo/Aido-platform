import type { StorePeriodType, SubscriptionEnvironment } from "@aido/api/vocabulary";

import type {
  StoreSubscriptionEventKind,
  SubscriptionEndReason,
  SubscriptionProvider,
  SubscriptionStore,
} from "./subscriptions.constants.js";

/** 운영 알림에만 보여 주는 부가 정보. 업무 판단에 쓰지 않는다. */
export interface StoreSubscriptionEventDetails {
  readonly countryCode?: string;
  readonly appVersion?: string;
  readonly deviceModel?: string;
}

export interface StoreSubscriptionPrice {
  readonly usd?: number;
  readonly amountInPurchasedCurrency?: number;
  readonly purchasedCurrency?: string;
}

interface StoreSubscriptionEventBase {
  readonly provider: SubscriptionProvider;
  /** 공급자가 이벤트마다 주는 ID. 처리 원장의 중복 방지 키다. 없으면 비운다. */
  readonly providerEventId?: string;
  /** 공급자의 원래 이벤트 이름. 처리 원장에만 남기고 판단에 쓰지 않는다. */
  readonly providerEventType: string;
  readonly environment: SubscriptionEnvironment | null;
  readonly store: SubscriptionStore | null;
  readonly details: StoreSubscriptionEventDetails;
}

/** 한 구독 체인에 일어난 이벤트 */
interface StoreChainEventBase extends StoreSubscriptionEventBase {
  /** 스토어 구매를 우리 사용자와 잇는 앱 사용자 ID(User.id 또는 별칭) */
  readonly appUserId: string;
  /** 갱신 체인의 ID(원 거래 ID). 공급자가 보내지 않으면 비우고 처리 단계가 거절한다. */
  readonly storeSubscriptionId?: string;
  readonly productId: string;
  /** 지금 기간의 끝. 공급자가 보내지 않았으면 비운다. */
  readonly periodEndsAt?: Temporal.Instant;
  /** 지금 기간의 유형. 없거나 모르는 값이면 null이다. */
  readonly periodKind: StorePeriodType | null;
  readonly price: StoreSubscriptionPrice;
}

export interface SubscriptionStartedEvent extends StoreChainEventBase {
  readonly kind: "STARTED";
  /** 기간 없는 일회성 구매 */
  readonly isOneTime: boolean;
  readonly startedAt?: Temporal.Instant;
}

export interface SubscriptionRenewedEvent extends StoreChainEventBase {
  readonly kind: "RENEWED";
  /** 행이 없는 체인을 이어 받을 때 쓰는 처음 산 시각 */
  readonly startedAt?: Temporal.Instant;
  /** 무료 체험이 끝나 첫 결제로 넘어간 갱신 */
  readonly isTrialConversion: boolean;
}

export interface SubscriptionCancelledEvent extends StoreChainEventBase {
  readonly kind: Extract<StoreSubscriptionEventKind, "CANCELLED" | "REFUNDED">;
  readonly reason: SubscriptionEndReason | null;
}

export interface SubscriptionExpiredEvent extends StoreChainEventBase {
  readonly kind: "EXPIRED";
  readonly reason: SubscriptionEndReason | null;
}

export interface SubscriptionBillingIssueEvent extends StoreChainEventBase {
  readonly kind: "BILLING_ISSUE";
  /** 스토어가 결제를 다시 시도하는 유예의 끝. 유예를 쓰지 않으면 null이다. */
  readonly gracePeriodEndsAt: Temporal.Instant | null;
}

interface SubscriptionProductChangeScheduledEvent extends StoreChainEventBase {
  readonly kind: "PRODUCT_CHANGE_SCHEDULED";
  /** 다음 갱신에 적용될 상품. 공급자가 알려 주지 않으면 비운다. */
  readonly newProductId?: string;
}

interface SubscriptionUncancelledEvent extends StoreChainEventBase {
  readonly kind: "UNCANCELLED";
}

interface SubscriptionExtendedEvent extends StoreChainEventBase {
  readonly kind: "EXTENDED";
}

/** 처리하지 않는 공급자 이벤트. 사용자를 찾지 않고 로그만 남긴다. */
interface SubscriptionIgnoredEvent extends StoreChainEventBase {
  readonly kind: "IGNORED";
}

export interface SubscriptionTransferredEvent extends StoreSubscriptionEventBase {
  readonly kind: "TRANSFERRED";
  /** 구매를 넘겨받은 앱 사용자 ID. 우리 사용자로 매핑되는 첫 값이 받은 사용자다. */
  readonly receivers: readonly string[];
  readonly transferredFrom: readonly string[];
}

/** 공급자를 모르는 스토어 구독 이벤트. 공급자 번역기가 원문에서 만든다. */
export type StoreSubscriptionEvent =
  | SubscriptionStartedEvent
  | SubscriptionRenewedEvent
  | SubscriptionCancelledEvent
  | SubscriptionExpiredEvent
  | SubscriptionBillingIssueEvent
  | SubscriptionProductChangeScheduledEvent
  | SubscriptionUncancelledEvent
  | SubscriptionExtendedEvent
  | SubscriptionIgnoredEvent
  | SubscriptionTransferredEvent;

export type StoreSubscriptionChainEvent = Exclude<
  StoreSubscriptionEvent,
  SubscriptionTransferredEvent
>;
