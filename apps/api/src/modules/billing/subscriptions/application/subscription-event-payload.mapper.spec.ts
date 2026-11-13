import type { PremiumAccess } from "../../shared/domain/premium-access.domain-service.js";
import type { StoreSubscriptionChainEvent } from "../domain/store-subscription.event.js";
import type { SubscriptionUser } from "./ports/subscription-user.reader.port.js";
import { baseEventPayload, premiumAccessSummaryOf } from "./subscription-event-payload.mapper.js";

type NotifiableEvent = Exclude<StoreSubscriptionChainEvent, { kind: "IGNORED" }>;

const user: SubscriptionUser = {
  id: "user-1",
  email: "user@example.com",
  profile: { name: "매튜" },
};

const common = {
  provider: "REVENUECAT",
  providerEventId: "evt-1",
  providerEventType: "X",
  environment: "PRODUCTION",
  store: "APP_STORE",
  details: { countryCode: "KR" },
  appUserId: "user-1",
  storeSubscriptionId: "otx-1",
  productId: "com.aido.pro.yearly",
  periodEndsAt: Temporal.Instant.from("2027-11-10T00:00:00.000Z"),
  periodKind: "NORMAL",
  price: { usd: 27.99, amountInPurchasedCurrency: 39_000, purchasedCurrency: "KRW" },
} as const;

describe("baseEventPayload — 웹훅 값을 이벤트마다 같은 이름으로 싣는다", () => {
  it.each<{ readonly label: string; readonly event: NotifiableEvent }>([
    { label: "만료", event: { ...common, kind: "EXPIRED", reason: "BILLING_ERROR" } },
    { label: "해지", event: { ...common, kind: "CANCELLED", reason: "UNSUBSCRIBE" } },
    { label: "결제 문제", event: { ...common, kind: "BILLING_ISSUE", gracePeriodEndsAt: null } },
    { label: "연장", event: { ...common, kind: "EXTENDED" } },
  ])("$label 이벤트에도 금액·만료·요금제·국가가 있다", ({ event }) => {
    // When
    const payload = baseEventPayload(user, event, "otx-1");

    // Then
    expect(payload).toMatchObject({
      planType: "ANNUAL",
      priceUsd: 27.99,
      priceInPurchasedCurrency: 39_000,
      purchasedCurrency: "KRW",
      expiresAt: "2027-11-10T00:00:00.000Z",
      countryCode: "KR",
      environment: "PRODUCTION",
    });
  });

  it("상품 변경 예약은 바뀔 상품과 그 요금제를 싣는다", () => {
    // Given
    const event: NotifiableEvent = {
      ...common,
      kind: "PRODUCT_CHANGE_SCHEDULED",
      newProductId: "com.aido.pro.monthly",
    };

    // When
    const payload = baseEventPayload(user, event, "otx-1");

    // Then
    expect(payload).toMatchObject({ newProductId: "com.aido.pro.monthly", newPlanType: "MONTHLY" });
  });

  it("결제 문제는 스토어 결제 유예의 끝을 싣는다", () => {
    // Given
    const event: NotifiableEvent = {
      ...common,
      kind: "BILLING_ISSUE",
      gracePeriodEndsAt: Temporal.Instant.from("2027-11-26T00:00:00.000Z"),
    };

    // When
    const payload = baseEventPayload(user, event, "otx-1");

    // Then
    expect(payload.gracePeriodEndsAt).toBe("2027-11-26T00:00:00.000Z");
  });
});

describe("premiumAccessSummaryOf — 이벤트 뒤 프리미엄 상태", () => {
  const none: PremiumAccess = {
    source: null,
    endsAt: null,
    periodEndsAt: null,
    willRenew: false,
    bankedDays: 0,
    recentGrantEndedAt: null,
    isTrial: false,
    planType: null,
  };

  it.each([
    {
      label: "프리미엄이 아니면",
      access: none,
      expected: { source: null, periodEndsAt: null, bankedDays: 0, isTrial: false },
    },
    {
      label: "스토어 뒤로 보상을 쌓아 두면",
      access: {
        ...none,
        source: "STORE" as const,
        periodEndsAt: Temporal.Instant.from("2028-03-04T00:00:00.000Z"),
        bankedDays: 7,
      },
      expected: {
        source: "STORE",
        periodEndsAt: "2028-03-04T00:00:00.000Z",
        bankedDays: 7,
        isTrial: false,
      },
    },
    {
      label: "보상 기간이 이어지면",
      access: {
        ...none,
        source: "GRANT" as const,
        periodEndsAt: Temporal.Instant.from("2028-03-04T00:00:00.000Z"),
      },
      expected: {
        source: "GRANT",
        periodEndsAt: "2028-03-04T00:00:00.000Z",
        bankedDays: 0,
        isTrial: false,
      },
    },
  ])("$label 출처와 보상 일수를 그대로 싣는다", ({ access, expected }) => {
    // When / Then
    expect(premiumAccessSummaryOf(access)).toEqual(expected);
  });
});
