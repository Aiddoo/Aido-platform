import { PREMIUM_SOURCE, type StorePeriodType } from "@aido/api/vocabulary";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { PremiumAccess } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import {
  type StoreLifecycleEvent,
  SubscriptionLifecyclePolicy,
} from "../../../domain/policies/subscriptions/subscription-lifecycle.policy.js";
import type { SubscriptionUser } from "../../ports/subscriptions/subscription.repository.port.js";
import type {
  StoreSubscriptionChainEvent,
  SubscriptionTransferredEvent,
} from "../../types/subscriptions/store-subscription-event.js";
import type {
  PremiumGrantImpact,
  SubscriptionEventPayload,
} from "../../types/subscriptions/subscription-event.payload.js";

type NotifiableChainEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;

/** 체험 판단에 쓰는 이벤트 값 */
export function lifecycleEventOf(event: StoreSubscriptionChainEvent): StoreLifecycleEvent {
  return {
    kind: event.kind,
    isOneTime: event.kind === "STARTED" && event.isOneTime,
    periodType: event.periodKind,
    isTrialConversion: event.kind === "RENEWED" && event.isTrialConversion,
  };
}

/** 이 이벤트 뒤 구독 행에 저장할 기간 유형. undefined면 저장값을 둔다. */
export function periodTypeAfter(event: StoreSubscriptionChainEvent): StorePeriodType | undefined {
  return SubscriptionLifecyclePolicy.periodTypeAfter(lifecycleEventOf(event));
}

export function baseEventPayload(
  user: SubscriptionUser,
  event: NotifiableChainEvent,
  storeSubscriptionId?: string,
): SubscriptionEventPayload {
  const lifecycle = SubscriptionLifecyclePolicy.classify(lifecycleEventOf(event));
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    kind: event.kind,
    ...(event.kind === "STARTED" && { isOneTime: event.isOneTime }),
    productId: event.productId,
    store: event.store,
    ...(event.environment != null && { environment: event.environment }),
    appUserId: event.appUserId,
    ...(event.providerEventId != null && { eventId: event.providerEventId }),
    ...(event.details.countryCode != null && { countryCode: event.details.countryCode }),
    ...(event.periodKind != null && { periodKind: event.periodKind }),
    ...(event.details.appVersion != null && { appVersion: event.details.appVersion }),
    ...(event.details.deviceModel != null && { deviceModel: event.details.deviceModel }),
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
  };
}

/** 쌓아 둔 보상이 있거나 보상 기간이 이어질 때만 알림에 싣는다. */
export function premiumGrantImpactOf(access: PremiumAccess): PremiumGrantImpact | undefined {
  const resumed = access.source === PREMIUM_SOURCE.GRANT;
  if (access.bankedDays === 0 && !resumed) {
    return undefined;
  }
  return {
    bankedDays: access.bankedDays,
    grantPeriodEndsAt: resumed ? toISOStringOrNull(access.periodEndsAt) : null,
  };
}
