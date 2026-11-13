import type {
  SignupEventProvider,
  SignupMethod,
  SubscriptionAlertKind,
  SubscriptionAlertLifecycle,
  SubscriptionNoticeEvent,
} from "../../domain/admin-notices.constants.js";
import type {
  SubscriptionNoticeInput,
  UserRegisteredAlertInput,
} from "../ports/admin-event-notifier.port.js";
import type { AdminNotice, AdminNoticeUser } from "../read-models/admin-notice.read-model.js";

const KIND_EVENTS = {
  STARTED: "purchased",
  RENEWED: "renewed",
  CANCELLED: "cancellation_scheduled",
  REFUNDED: "refunded",
  UNCANCELLED: "uncancelled",
  EXPIRED: "expired",
  BILLING_ISSUE: "billing_issue",
  PRODUCT_CHANGE_SCHEDULED: "product_change_scheduled",
  EXTENDED: "extended",
  TRANSFERRED: "transferred",
} as const satisfies Record<SubscriptionAlertKind, SubscriptionNoticeEvent>;

const LIFECYCLE_EVENTS = {
  trial_started: "trial_started",
  trial_cancelled: "trial_cancelled",
  trial_converted: "trial_converted",
  trial_expired: "trial_expired",
} as const satisfies Record<SubscriptionAlertLifecycle, SubscriptionNoticeEvent>;

const SIGNUP_METHODS_BY_PROVIDER = {
  credential: "CREDENTIAL",
  apple: "APPLE",
  google: "GOOGLE",
  kakao: "KAKAO",
  naver: "NAVER",
} as const satisfies Record<SignupEventProvider, SignupMethod>;

/** 환불은 체험 중 해지처럼 체험 단계로 분류돼도 환불로 알린다. 그다음 체험 단계, 일회성 구매 순이다. */
export function subscriptionNoticeEventOf(
  payload: SubscriptionNoticeInput,
): SubscriptionNoticeEvent {
  if (payload.kind === "REFUNDED") {
    return "refunded";
  }
  if (payload.lifecycle != null) {
    return LIFECYCLE_EVENTS[payload.lifecycle];
  }
  if (payload.kind === "STARTED" && payload.isOneTime === true) {
    return "one_time_purchased";
  }
  return KIND_EVENTS[payload.kind];
}

/** 사용자 조회가 실패하거나 사용자가 없을 때 billing이 준 값으로 채우는 사용자 블록 */
export function subscriptionNoticeUserOf(payload: SubscriptionNoticeInput): AdminNoticeUser {
  return {
    userId: payload.userId,
    email: payload.email,
    ...(payload.name != null && { nickname: payload.name }),
  };
}

/** 사용자 조회가 실패하거나 사용자가 없을 때 가입 요청 값으로 채우는 사용자 블록 */
export function registeredNoticeUserOf(payload: UserRegisteredAlertInput): AdminNoticeUser {
  return {
    userId: payload.userId,
    email: payload.email,
    ...(payload.name != null && { nickname: payload.name }),
    joinedAt: payload.registeredAt,
    signupMethod: SIGNUP_METHODS_BY_PROVIDER[payload.provider],
  };
}

export function buildSubscriptionNotice(
  payload: SubscriptionNoticeInput,
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
  payload: UserRegisteredAlertInput,
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
