import type { RevenueCatWebhookPayload } from "@aido/api";
import {
  PREMIUM_SOURCE,
  type StorePeriodType,
  type SubscriptionEnvironment,
} from "@aido/api/vocabulary";
import { z } from "zod";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { PremiumAccess } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import {
  type StoreLifecycleEvent,
  SubscriptionLifecyclePolicy,
  toStorePeriodType,
} from "../../../domain/policies/subscriptions/subscription-lifecycle.policy.js";
import type { SubscriptionUser } from "../../ports/subscriptions/subscription.repository.port.js";
import type {
  PremiumGrantImpact,
  SubscriptionEventPayload,
} from "../../types/subscriptions/subscription-event.payload.js";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

const optionalText = z.string().min(1).optional().catch(undefined);
const attributeText = z
  .looseObject({ value: z.string().min(1) })
  .transform((attribute) => attribute.value)
  .optional()
  .catch(undefined);

/** 알림 표시용 부가 정보. 형식이 다르면 그 필드만 버리고 업무 처리는 막지 않는다. */
const alertDetailsSchema = z.looseObject({
  id: optionalText,
  country_code: optionalText,
  period_type: optionalText,
  expiration_reason: optionalText,
  subscriber_attributes: z
    .looseObject({ appVersion: attributeText, deviceModel: attributeText })
    .optional()
    .catch(undefined),
});

function alertDetails(event: RevenueCatEvent): Partial<SubscriptionEventPayload> {
  const parsed = alertDetailsSchema.safeParse(event);
  if (!parsed.success) {
    return {};
  }
  const details = parsed.data;
  const attributes = details.subscriber_attributes;
  return {
    ...(details.id != null && { eventId: details.id }),
    ...(details.country_code != null && { countryCode: details.country_code }),
    ...(details.period_type != null && { periodType: details.period_type }),
    ...(details.expiration_reason != null && { expirationReason: details.expiration_reason }),
    ...(attributes?.appVersion != null && { appVersion: attributes.appVersion }),
    ...(attributes?.deviceModel != null && { deviceModel: attributes.deviceModel }),
  };
}

/** 체험 판단에 쓰는 이벤트 값. 웹훅 문자열을 알려진 기간 유형으로 읽는다. */
export function lifecycleEventOf(event: RevenueCatEvent): StoreLifecycleEvent {
  return {
    type: event.type,
    periodType: toStorePeriodType(event.period_type),
    isTrialConversion: event.is_trial_conversion === true,
  };
}

/** 이 이벤트 뒤 구독 행에 저장할 기간 유형. undefined면 저장값을 둔다. */
export function periodTypeAfter(event: RevenueCatEvent): StorePeriodType | undefined {
  return SubscriptionLifecyclePolicy.periodTypeAfter(lifecycleEventOf(event));
}

export function baseEventPayload(
  user: SubscriptionUser,
  event: RevenueCatEvent,
  transactionId?: string,
): SubscriptionEventPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    eventType: event.type,
    productId: event.product_id,
    store: event.store,
    ...(event.environment != null && { environment: event.environment }),
    appUserId: event.app_user_id,
    ...alertDetails(event),
    ...(transactionId != null && { transactionId }),
    ...lifecyclePayload(event),
  };
}

function lifecyclePayload(event: RevenueCatEvent): Pick<SubscriptionEventPayload, "lifecycle"> {
  const lifecycle = SubscriptionLifecyclePolicy.classify(lifecycleEventOf(event));
  return lifecycle == null ? {} : { lifecycle };
}

/** TRANSFER 처리에 필요한 값. RevenueCat TRANSFER에는 구독자·상품 필드가 없다. */
export interface TransferEvent {
  readonly id?: string;
  readonly type: "TRANSFER";
  readonly store?: string;
  readonly environment?: SubscriptionEnvironment;
  /** 구매를 넘겨받은 app_user_id. 우리 사용자로 매핑되는 첫 값이 받은 사용자다. */
  readonly receivers: readonly string[];
  readonly transferredFrom: readonly string[];
}

/** TRANSFER에는 상품이 없어 운영 알림의 상품 칸을 비우지 않도록 표시한다. */
const TRANSFER_PRODUCT_LABEL = "-";

export function transferEventPayload(
  user: SubscriptionUser,
  event: TransferEvent,
  appUserId: string,
): SubscriptionEventPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.profile?.name ?? undefined,
    eventType: event.type,
    productId: TRANSFER_PRODUCT_LABEL,
    store: event.store,
    ...(event.environment != null && { environment: event.environment }),
    appUserId,
    ...(event.id != null && event.id !== "" && { eventId: event.id }),
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
