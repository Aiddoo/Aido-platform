import type { SubscriptionNoticeEvent } from "../read-models/admin-notice.read-model.js";
import type { SubscriptionAlertInput } from "../read-models/subscription-alert.read-model.js";
import {
  buildSubscriptionNotice,
  registeredNoticeUserOf,
  subscriptionNoticeEventOf,
} from "./admin-notice.messages.js";

const base: SubscriptionAlertInput = {
  userId: "user-1",
  email: "user@example.com",
  kind: "STARTED",
  productId: "com.aido.pro.monthly",
  store: "APP_STORE",
};

describe("subscriptionNoticeEventOf — 운영자가 구분할 구독 이벤트", () => {
  it.each<{
    readonly label: string;
    readonly payload: Partial<SubscriptionAlertInput>;
    readonly expected: SubscriptionNoticeEvent;
  }>([
    { label: "새 구독", payload: { kind: "STARTED" }, expected: "purchased" },
    {
      label: "일회성 구매",
      payload: { kind: "STARTED", isOneTime: true },
      expected: "one_time_purchased",
    },
    {
      label: "체험 시작",
      payload: { kind: "STARTED", lifecycle: "trial_started" },
      expected: "trial_started",
    },
    {
      label: "체험 → 유료 전환",
      payload: { kind: "RENEWED", lifecycle: "trial_converted" },
      expected: "trial_converted",
    },
    { label: "갱신", payload: { kind: "RENEWED" }, expected: "renewed" },
    { label: "해지 예약", payload: { kind: "CANCELLED" }, expected: "cancellation_scheduled" },
    {
      label: "체험 해지",
      payload: { kind: "CANCELLED", lifecycle: "trial_cancelled" },
      expected: "trial_cancelled",
    },
    { label: "해지 취소", payload: { kind: "UNCANCELLED" }, expected: "uncancelled" },
    { label: "만료", payload: { kind: "EXPIRED" }, expected: "expired" },
    {
      label: "체험 종료",
      payload: { kind: "EXPIRED", lifecycle: "trial_expired" },
      expected: "trial_expired",
    },
    { label: "결제 문제", payload: { kind: "BILLING_ISSUE" }, expected: "billing_issue" },
    { label: "환불", payload: { kind: "REFUNDED" }, expected: "refunded" },
    {
      label: "체험 중 환불",
      payload: { kind: "REFUNDED", lifecycle: "trial_cancelled" },
      expected: "refunded",
    },
    {
      label: "상품 변경 예약",
      payload: { kind: "PRODUCT_CHANGE_SCHEDULED" },
      expected: "product_change_scheduled",
    },
    { label: "이전", payload: { kind: "TRANSFERRED" }, expected: "transferred" },
    { label: "연장", payload: { kind: "EXTENDED" }, expected: "extended" },
  ])("$label → $expected", ({ payload, expected }) => {
    // When / Then
    expect(subscriptionNoticeEventOf({ ...base, ...payload })).toBe(expected);
  });
});

describe("buildSubscriptionNotice — 결제 블록", () => {
  it("웹훅이 준 해지 사유·만료·유예·바뀔 상품·이전 계정을 공급자 중립 이름으로 옮긴다", () => {
    // Given
    const payload: SubscriptionAlertInput = {
      ...base,
      kind: "BILLING_ISSUE",
      endReason: "BILLING_ERROR",
      expiresAt: "2027-01-01T00:00:00.000Z",
      gracePeriodEndsAt: "2027-01-17T00:00:00.000Z",
      newProductId: "com.aido.pro.yearly",
      newPlanType: "ANNUAL",
      transfer: { from: ["old"], to: ["new"] },
      premium: { source: "STORE", periodEndsAt: null, bankedDays: 0, isTrial: false },
      providerCustomerUrl: "https://app.revenuecat.com/projects/p/customers/user-1",
    };

    // When
    const notice = buildSubscriptionNotice(payload, { userId: "user-1", email: "u@example.com" });

    // Then
    expect(notice).toMatchObject({
      type: "subscription_event",
      subscription: {
        event: "billing_issue",
        endReason: "BILLING_ERROR",
        expiresAt: "2027-01-01T00:00:00.000Z",
        gracePeriodEndsAt: "2027-01-17T00:00:00.000Z",
        newProductId: "com.aido.pro.yearly",
        newPlanType: "ANNUAL",
        transfer: { from: ["old"], to: ["new"] },
        premium: { source: "STORE", bankedDays: 0, isTrial: false },
        customerUrl: "https://app.revenuecat.com/projects/p/customers/user-1",
      },
    });
  });

  it("이전 이벤트는 상품이 없으므로 상품 칸을 비운다", () => {
    // When
    const notice = buildSubscriptionNotice(
      { ...base, kind: "TRANSFERRED", productId: "-" },
      { userId: "user-1", email: "u@example.com" },
    );

    // Then
    expect(notice.type === "subscription_event" && notice.subscription.productId).toBeUndefined();
  });
});

describe("registeredNoticeUserOf — 가입 요청으로 채우는 사용자 블록", () => {
  it.each([
    ["credential", "CREDENTIAL"],
    ["apple", "APPLE"],
    ["google", "GOOGLE"],
    ["kakao", "KAKAO"],
    ["naver", "NAVER"],
  ] as const)("%s 가입은 %s 가입 방식이다", (provider, signupMethod) => {
    // When
    const user = registeredNoticeUserOf({
      userId: "user-1",
      email: "u@example.com",
      provider,
      registeredAt: "2026-03-07T12:00:00.000Z",
    });

    // Then
    expect(user.signupMethod).toBe(signupMethod);
  });
});
