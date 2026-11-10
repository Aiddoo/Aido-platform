import {
  type AdminNotice,
  type AdminNoticeUser,
  SIGNUP_METHOD,
  type SignupMethod,
  SUBSCRIPTION_NOTICE_EVENT,
  type SubscriptionNoticeEvent,
} from "../read-models/admin-notice.read-model.js";
import type {
  SubscriptionAlertInput,
  SubscriptionAlertKind,
  SubscriptionAlertLifecycle,
} from "../read-models/subscription-alert.read-model.js";
import type { UserRegisteredEventPayload } from "../read-models/user-registered.read-model.js";

const KIND_EVENTS = {
  STARTED: SUBSCRIPTION_NOTICE_EVENT.PURCHASED,
  RENEWED: SUBSCRIPTION_NOTICE_EVENT.RENEWED,
  CANCELLED: SUBSCRIPTION_NOTICE_EVENT.CANCELLATION_SCHEDULED,
  REFUNDED: SUBSCRIPTION_NOTICE_EVENT.REFUNDED,
  UNCANCELLED: SUBSCRIPTION_NOTICE_EVENT.UNCANCELLED,
  EXPIRED: SUBSCRIPTION_NOTICE_EVENT.EXPIRED,
  BILLING_ISSUE: SUBSCRIPTION_NOTICE_EVENT.BILLING_ISSUE,
  PRODUCT_CHANGE_SCHEDULED: SUBSCRIPTION_NOTICE_EVENT.PRODUCT_CHANGE_SCHEDULED,
  EXTENDED: SUBSCRIPTION_NOTICE_EVENT.EXTENDED,
  TRANSFERRED: SUBSCRIPTION_NOTICE_EVENT.TRANSFERRED,
} as const satisfies Record<SubscriptionAlertKind, SubscriptionNoticeEvent>;

const LIFECYCLE_EVENTS = {
  trial_started: SUBSCRIPTION_NOTICE_EVENT.TRIAL_STARTED,
  trial_cancelled: SUBSCRIPTION_NOTICE_EVENT.TRIAL_CANCELLED,
  trial_converted: SUBSCRIPTION_NOTICE_EVENT.TRIAL_CONVERTED,
  trial_expired: SUBSCRIPTION_NOTICE_EVENT.TRIAL_EXPIRED,
} as const satisfies Record<SubscriptionAlertLifecycle, SubscriptionNoticeEvent>;

const SIGNUP_METHODS_BY_PROVIDER = {
  credential: SIGNUP_METHOD.CREDENTIAL,
  apple: SIGNUP_METHOD.APPLE,
  google: SIGNUP_METHOD.GOOGLE,
  kakao: SIGNUP_METHOD.KAKAO,
  naver: SIGNUP_METHOD.NAVER,
} as const satisfies Record<UserRegisteredEventPayload["provider"], SignupMethod>;

/** 환불은 체험 중 해지처럼 체험 단계로 분류돼도 환불로 알린다. 그다음 체험 단계, 일회성 구매 순이다. */
export function subscriptionNoticeEventOf(
  payload: SubscriptionAlertInput,
): SubscriptionNoticeEvent {
  if (payload.kind === "REFUNDED") {
    return SUBSCRIPTION_NOTICE_EVENT.REFUNDED;
  }
  if (payload.lifecycle != null) {
    return LIFECYCLE_EVENTS[payload.lifecycle];
  }
  if (payload.kind === "STARTED" && payload.isOneTime === true) {
    return SUBSCRIPTION_NOTICE_EVENT.ONE_TIME_PURCHASED;
  }
  return KIND_EVENTS[payload.kind];
}

/** 사용자 조회가 실패하거나 사용자가 없을 때 billing이 준 값으로 채우는 사용자 블록 */
export function subscriptionNoticeUserOf(payload: SubscriptionAlertInput): AdminNoticeUser {
  return {
    userId: payload.userId,
    email: payload.email,
    ...(payload.name != null && { nickname: payload.name }),
  };
}

/** 사용자 조회가 실패하거나 사용자가 없을 때 가입 요청 값으로 채우는 사용자 블록 */
export function registeredNoticeUserOf(payload: UserRegisteredEventPayload): AdminNoticeUser {
  return {
    userId: payload.userId,
    email: payload.email,
    ...(payload.name != null && { nickname: payload.name }),
    joinedAt: payload.registeredAt,
    signupMethod: SIGNUP_METHODS_BY_PROVIDER[payload.provider],
  };
}

export function buildSubscriptionNotice(
  payload: SubscriptionAlertInput,
  user: AdminNoticeUser,
): AdminNotice {
  return {
    type: "subscription_event",
    user,
    subscription: {
      event: subscriptionNoticeEventOf(payload),
      ...(payload.environment != null && { environment: payload.environment }),
      ...(payload.store != null && { store: payload.store }),
      // 이전 이벤트에는 상품이 없다
      ...(payload.kind !== "TRANSFERRED" && { productId: payload.productId }),
      ...(payload.planType != null && { planType: payload.planType }),
      ...(payload.newProductId != null && { newProductId: payload.newProductId }),
      ...(payload.newPlanType != null && { newPlanType: payload.newPlanType }),
      ...(payload.periodKind != null && { periodKind: payload.periodKind }),
      price: {
        ...(payload.priceInPurchasedCurrency != null && {
          amount: payload.priceInPurchasedCurrency,
        }),
        ...(payload.purchasedCurrency != null && { currency: payload.purchasedCurrency }),
        ...(payload.priceUsd != null && { usd: payload.priceUsd }),
      },
      ...(payload.purchasedAt != null && { purchasedAt: payload.purchasedAt }),
      ...(payload.expiresAt != null && { expiresAt: payload.expiresAt }),
      ...(payload.gracePeriodEndsAt != null && { gracePeriodEndsAt: payload.gracePeriodEndsAt }),
      ...(payload.endReason != null && { endReason: payload.endReason }),
      ...(payload.countryCode != null && { countryCode: payload.countryCode }),
      ...(payload.isFirstPurchase != null && { isFirstPurchase: payload.isFirstPurchase }),
      ...(payload.premium != null && {
        premium: {
          source: payload.premium.source,
          ...(payload.premium.periodEndsAt != null && {
            periodEndsAt: payload.premium.periodEndsAt,
          }),
          bankedDays: payload.premium.bankedDays,
          isTrial: payload.premium.isTrial,
        },
      }),
      ...(payload.transfer != null && {
        transfer: { from: [...payload.transfer.from], to: [...payload.transfer.to] },
      }),
      ...(payload.storeSubscriptionId != null && {
        storeSubscriptionId: payload.storeSubscriptionId,
      }),
      ...(payload.appVersion != null && { appVersion: payload.appVersion }),
      ...(payload.deviceModel != null && { deviceModel: payload.deviceModel }),
      ...(payload.providerCustomerUrl != null && { customerUrl: payload.providerCustomerUrl }),
    },
  };
}

export function buildUserRegisteredNotice(
  payload: UserRegisteredEventPayload,
  user: AdminNoticeUser,
): AdminNotice {
  return {
    type: "user_registered",
    user,
    signup: {
      ...(payload.devicePlatform != null && { devicePlatform: payload.devicePlatform }),
      ...(payload.deviceModel != null && { deviceModel: payload.deviceModel }),
      ...(payload.osVersion != null && { osVersion: payload.osVersion }),
      ...(payload.appVersion != null && { appVersion: payload.appVersion }),
      ...(payload.appBuild != null && { appBuild: payload.appBuild }),
      ...(payload.locale != null && { locale: payload.locale }),
      ...(payload.timezone != null && { timezone: payload.timezone }),
    },
  };
}
