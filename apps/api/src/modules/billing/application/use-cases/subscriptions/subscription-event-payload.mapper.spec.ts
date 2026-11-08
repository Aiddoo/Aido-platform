import { revenueCatEventSchema } from "@aido/api";

import { SubscriptionEventBuilder } from "#test/builders/index";

import { baseEventPayload, premiumGrantImpactOf } from "./subscription-event-payload.mapper.js";

const user = { id: "user-1", email: "user@example.com", profile: { name: "사용자" } };

describe("baseEventPayload — 운영 알림 부가 정보", () => {
  it("RevenueCat 이벤트의 ID·국가·구독 유형·만료 사유·앱 속성을 싣는다", () => {
    // Given
    const { event } = SubscriptionEventBuilder.expiration()
      .withAppUserId("app-user-1")
      .withEventId("event-1")
      .withEnvironment("SANDBOX")
      .withPeriodType("TRIAL")
      .build();
    const raw = {
      ...event,
      country_code: "KR",
      expiration_reason: "UNSUBSCRIBE",
      subscriber_attributes: {
        appVersion: { value: "1.14.0", updated_at_ms: 1 },
        deviceModel: { value: "iPhone16,1", updated_at_ms: 1 },
      },
    };

    // When
    const payload = baseEventPayload(
      { ...user, subscriptionStatus: "FREE", subscriptionExpiresAt: null, revenueCatUserId: null },
      raw,
    );

    // Then
    expect(payload).toMatchObject({
      appUserId: "app-user-1",
      eventId: "event-1",
      environment: "SANDBOX",
      countryCode: "KR",
      periodType: "TRIAL",
      expirationReason: "UNSUBSCRIBE",
      appVersion: "1.14.0",
      deviceModel: "iPhone16,1",
    });
  });

  it("형식이 다른 부가 정보는 그 필드만 버린다", () => {
    // Given
    const { event } = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId("app-user-1")
      .build();
    const raw = revenueCatEventSchema.parse({
      ...event,
      expiration_reason: 82,
      subscriber_attributes: { appVersion: "1.14.0" },
    });

    // When
    const payload = baseEventPayload(
      { ...user, subscriptionStatus: "FREE", subscriptionExpiresAt: null, revenueCatUserId: null },
      raw,
    );

    // Then
    expect(payload.expirationReason).toBeUndefined();
    expect(payload.appVersion).toBeUndefined();
    expect(payload.appUserId).toBe("app-user-1");
  });
});

describe("premiumGrantImpactOf — 보상 기간 영향", () => {
  const none = {
    source: null,
    endsAt: null,
    periodEndsAt: null,
    willRenew: false,
    bankedDays: 0,
    recentGrantEndedAt: null,
    isTrial: false,
  };

  it.each([
    { label: "보상이 없으면", access: none, expected: undefined },
    {
      label: "스토어 뒤로 쌓아 두면",
      access: { ...none, source: "STORE" as const, bankedDays: 7 },
      expected: { bankedDays: 7, grantPeriodEndsAt: null },
    },
    {
      label: "보상 기간이 이어지면",
      access: {
        ...none,
        source: "GRANT" as const,
        periodEndsAt: new Date("2028-03-04T00:00:00.000Z"),
      },
      expected: { bankedDays: 0, grantPeriodEndsAt: "2028-03-04T00:00:00.000Z" },
    },
  ])("$label 영향은 $expected다", ({ access, expected }) => {
    // When / Then
    expect(premiumGrantImpactOf(access)).toEqual(expected);
  });
});
