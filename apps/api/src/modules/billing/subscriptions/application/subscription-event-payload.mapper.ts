import type { StorePeriodType } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { PremiumAccess } from "../../shared/domain/premium-access.domain-service.js";
import { planTypeOfProduct } from "../../shared/domain/subscription-plan.domain-service.js";
import type {
  StoreSubscriptionChainEvent,
  StoreSubscriptionPrice,
  SubscriptionTransferredEvent,
} from "../domain/store-subscription.event.js";
import {
  type StoreLifecycleEvent,
  classifySubscriptionLifecycle,
  periodTypeAfterEvent,
} from "../domain/subscription-lifecycle.domain-service.js";
import type { SubscriptionUser } from "./ports/subscription-user.reader.port.js";
import type {
  PremiumAccessSummary,
  SubscriptionEventPayload,
} from "./read-models/subscription-event-payload.read-model.js";

type NotifiableChainEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;

/** 체험 판단에 쓰는 이벤트 값 */
function lifecycleEventOf(event: StoreSubscriptionChainEvent): StoreLifecycleEvent {
  return {
    kind: event.kind,
    isOneTime: event.kind === "STARTED" && event.isOneTime,
    periodType: event.periodKind,
    isTrialConversion: event.kind === "RENEWED" && event.isTrialConversion,
  };
}

/** 이 이벤트 뒤 구독 행에 저장할 기간 유형. undefined면 저장값을 둔다. */
export function periodTypeAfter(event: StoreSubscriptionChainEvent): StorePeriodType | undefined {
  return periodTypeAfterEvent(lifecycleEventOf(event));
}

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
