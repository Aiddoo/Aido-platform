import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
} from "#test/fixtures/billing/subscription.fixture";

import {
  applySubscriptionChange,
  type SubscriptionChangeEvent,
} from "./subscription-change.domain-service.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const EXPIRES_AT = NOW.add({ hours: 24 * 30 });
const NEXT_EXPIRES_AT = NOW.add({ hours: 24 * 60 });
const STALE_EXPIRES_AT = NOW.add({ hours: 24 });

const EVENT_BASE = {
  provider: "REVENUECAT",
  providerEventType: "TEST",
  environment: null,
  store: null,
  details: {},
  appUserId: "app-user",
  productId: "premium_monthly",
  periodKind: null,
  price: {},
} as const;

function apply(
  subscription: ReturnType<typeof createSubscriptionFixture>,
  event: SubscriptionChangeEvent,
  renewalExpiresAt?: Temporal.Instant,
) {
  return applySubscriptionChange({
    subscription,
    event,
    renewalExpiresAt,
    eventId: undefined,
    now: NOW,
  });
}

describe("applySubscriptionChange — 스토어 이벤트의 체인 전이", () => {
  it("갱신은 새 만료로 ACTIVE를 이어 가고 User 상태도 ACTIVE로 맞춘다", () => {
    // Given
    const subscription = createSubscriptionFixture({ status: "CANCELLED", cancelledAt: NOW });

    // When
    const change = apply(
      subscription,
      { ...EVENT_BASE, kind: "RENEWED", isTrialConversion: false },
      NEXT_EXPIRES_AT,
    );

    // Then
    expect(change).toEqual({
      fallback: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: NEXT_EXPIRES_AT },
      reportedExpiresAt: NEXT_EXPIRES_AT,
    });
    expect(subscription.toPrimitives()).toMatchObject({
      status: "ACTIVE",
      expiresAt: NEXT_EXPIRES_AT,
      cancelledAt: null,
    });
  });

  it("갱신의 새 만료 시각이 없거나 같은 만료의 재전송이면 바꾸지 않고 null이다", () => {
    // Given
    const subscription = createSubscriptionFixture();
    const event = { ...EVENT_BASE, kind: "RENEWED", isTrialConversion: false } as const;

    // When
    const withoutExpiry = apply(subscription, event, undefined);
    const duplicate = apply(subscription, event, EXPIRES_AT);

    // Then
    expect({ withoutExpiry, duplicate }).toEqual({ withoutExpiry: null, duplicate: null });
  });

  it("만료 전 해지는 CANCELLED로 두고 이용 종료 시각까지 User는 ACTIVE로 둔다", () => {
    // Given
    const subscription = createSubscriptionFixture();

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "CANCELLED",
      reason: null,
      periodEndsAt: EXPIRES_AT,
    });

    // Then
    expect(change?.fallback).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: EXPIRES_AT,
    });
    expect(subscription.toPrimitives()).toMatchObject({ status: "CANCELLED", cancelledAt: NOW });
  });

  it("환불은 바로 EXPIRED로 끝내고 User는 FREE로 되돌린다", () => {
    // Given
    const subscription = createSubscriptionFixture({ gracePeriodEndsAt: EXPIRES_AT });

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "REFUNDED",
      reason: null,
      periodEndsAt: EXPIRES_AT,
    });

    // Then
    expect(change?.fallback).toEqual({ subscriptionStatus: "FREE", subscriptionExpiresAt: null });
    expect(subscription.toPrimitives()).toMatchObject({
      status: "EXPIRED",
      gracePeriodEndsAt: null,
    });
  });

  it("해지 철회는 ACTIVE로 되돌리고 해지 시각을 지운다", () => {
    // Given
    const subscription = createSubscriptionFixture({ status: "CANCELLED", cancelledAt: NOW });

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "UNCANCELLED",
      periodEndsAt: EXPIRES_AT,
    });

    // Then
    expect(change?.fallback).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: EXPIRES_AT,
    });
    expect(subscription.toPrimitives()).toMatchObject({ status: "ACTIVE", cancelledAt: null });
  });

  it("만료는 EXPIRED로 끝내고 User는 FREE로 되돌린다", () => {
    // Given
    const subscription = createSubscriptionFixture();

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "EXPIRED",
      reason: null,
      periodEndsAt: EXPIRES_AT,
    });

    // Then
    expect(change?.fallback).toEqual({ subscriptionStatus: "FREE", subscriptionExpiresAt: null });
    expect(subscription.toPrimitives().status).toBe("EXPIRED");
  });

  it("지난 기간의 늦은 만료는 체인을 바꾸지 않고 null이다", () => {
    // Given
    const subscription = createSubscriptionFixture();

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "EXPIRED",
      reason: null,
      periodEndsAt: STALE_EXPIRES_AT,
    });

    // Then
    expect(change).toBeNull();
    expect(subscription.toPrimitives().status).toBe("ACTIVE");
  });

  it("상품 변경 예약은 다음 상품만 남기고 지금 상품과 ACTIVE는 그대로 둔다", () => {
    // Given
    const subscription = createSubscriptionFixture();

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "PRODUCT_CHANGE_SCHEDULED",
      newProductId: "premium_yearly",
    });

    // Then
    expect(change?.fallback.subscriptionStatus).toBe("ACTIVE");
    expect(subscription.toPrimitives()).toMatchObject({
      productId: "premium_monthly",
      nextProductId: "premium_yearly",
    });
  });

  it("연장은 새 만료로 ACTIVE를 이어 간다", () => {
    // Given
    const subscription = createSubscriptionFixture();

    // When
    const change = apply(subscription, {
      ...EVENT_BASE,
      kind: "EXTENDED",
      periodEndsAt: NEXT_EXPIRES_AT,
    });

    // Then
    expect(change?.fallback).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: NEXT_EXPIRES_AT,
    });
    expect(subscription.toPrimitives().expiresAt).toEqual(NEXT_EXPIRES_AT);
  });
});
