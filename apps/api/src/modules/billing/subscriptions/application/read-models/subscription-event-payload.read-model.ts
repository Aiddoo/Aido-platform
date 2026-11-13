import type {
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { PremiumAccess } from "../../../shared/domain/premium-access.domain-service.js";
import { planTypeOfProduct } from "../../../shared/domain/subscription-plan.domain-service.js";
import type {
  StoreSubscriptionChainEvent,
  StoreSubscriptionPrice,
  SubscriptionTransferredEvent,
} from "../../domain/store-subscription.event.js";
import {
  classifySubscriptionLifecycle,
  lifecycleEventOf,
  type SubscriptionLifecycle,
} from "../../domain/subscription-lifecycle.domain-service.js";
import type {
  StoreSubscriptionEventKind,
  SubscriptionEndReason,
  SubscriptionStore,
} from "../../domain/subscriptions.constants.js";
import type { SubscriptionUser } from "../ports/subscription-user.reader.port.js";

/**
 * 구독 이벤트 알림 페이로드. 구독 상태를 바꾼 뒤 운영 알림(결제 채널)으로 넘기고 공급자 이름을 모른다.
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

type NotifiableChainEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;

function priceFields(
  price: StoreSubscriptionPrice,
): Pick<SubscriptionEventPayload, "priceUsd" | "priceInPurchasedCurrency" | "purchasedCurrency"> {
  return {
    ...(price.usd != null && { priceUsd: price.usd }),
    ...(price.amountInPurchasedCurrency != null && {
      priceInPurchasedCurrency: price.amountInPurchasedCurrency,
    }),
    ...(price.purchasedCurrency != null && { purchasedCurrency: price.purchasedCurrency }),
  };
}

function planFields(
  productId: string | undefined,
  key: keyof Pick<SubscriptionEventPayload, "planType" | "newPlanType">,
): Pick<SubscriptionEventPayload, "planType" | "newPlanType"> {
  const planType = productId == null ? null : planTypeOfProduct(productId);
  return planType == null ? {} : { [key]: planType };
}

/**
 * 웹훅 이벤트가 준 값을 이벤트 종류와 상관없이 같은 이름으로 싣는다. 처리 단계가 확정한 값(만료 시각 등)은
 * 호출한 곳이 덮어쓴다.
 */
export function baseEventPayload(
  user: SubscriptionUser,
  event: NotifiableChainEvent,
  storeSubscriptionId?: string,
): SubscriptionEventPayload {
  const lifecycle = classifySubscriptionLifecycle(lifecycleEventOf(event));
  const purchasedAt =
    event.kind === "STARTED" || event.kind === "RENEWED" ? event.startedAt : undefined;
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    kind: event.kind,
    ...(event.kind === "STARTED" && { isOneTime: event.isOneTime }),
    productId: event.productId,
    ...planFields(event.productId, "planType"),
    store: event.store,
    ...(event.environment != null && { environment: event.environment }),
    appUserId: event.appUserId,
    ...(event.providerEventId != null && { eventId: event.providerEventId }),
    ...(event.details.countryCode != null && { countryCode: event.details.countryCode }),
    ...(event.periodKind != null && { periodKind: event.periodKind }),
    ...(event.details.appVersion != null && { appVersion: event.details.appVersion }),
    ...(event.details.deviceModel != null && { deviceModel: event.details.deviceModel }),
    ...priceFields(event.price),
    ...(purchasedAt != null && { purchasedAt: toIsoString(purchasedAt) }),
    ...(event.periodEndsAt != null && { expiresAt: toIsoString(event.periodEndsAt) }),
    ...(event.kind === "BILLING_ISSUE" &&
      event.gracePeriodEndsAt != null && {
        gracePeriodEndsAt: toIsoString(event.gracePeriodEndsAt),
      }),
    ...(event.kind === "PRODUCT_CHANGE_SCHEDULED" &&
      event.newProductId != null && {
        newProductId: event.newProductId,
        ...planFields(event.newProductId, "newPlanType"),
      }),
    ...((event.kind === "CANCELLED" || event.kind === "REFUNDED" || event.kind === "EXPIRED") &&
      event.reason != null && { endReason: event.reason }),
    ...(storeSubscriptionId != null && { storeSubscriptionId }),
    ...(lifecycle != null && { lifecycle }),
  };
}

/** 이전에는 상품이 없어 운영 알림의 상품 칸을 비우지 않도록 표시한다. */
const TRANSFER_PRODUCT_LABEL = "-";

export function transferEventPayload(
  user: SubscriptionUser,
  event: SubscriptionTransferredEvent,
  appUserId: string,
): SubscriptionEventPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    kind: event.kind,
    productId: TRANSFER_PRODUCT_LABEL,
    store: event.store,
    ...(event.environment != null && { environment: event.environment }),
    appUserId,
    ...(event.providerEventId != null && { eventId: event.providerEventId }),
    ...(event.details.countryCode != null && { countryCode: event.details.countryCode }),
    transfer: { from: [...event.transferredFrom], to: [...event.receivers] },
  };
}

/** 이벤트를 반영한 뒤의 프리미엄 출처·보상 일수 */
export function premiumAccessSummaryOf(access: PremiumAccess): PremiumAccessSummary {
  return {
    source: access.source,
    periodEndsAt: access.periodEndsAt == null ? null : toIsoString(access.periodEndsAt),
    bankedDays: access.bankedDays,
    isTrial: access.isTrial,
  };
}
