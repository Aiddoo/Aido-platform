import {
  type RevenueCatTranslationOptions,
  translateRevenueCatWebhook,
} from "./revenuecat-webhook-translator.adapter.js";

const PURCHASED_AT_MS = 1_591_121_853_000;
const EXPIRES_AT_MS = 1_591_726_653_000;

// RevenueCat 웹훅 문서의 이벤트 예시(https://www.revenuecat.com/docs/integrations/webhooks/sample-events)
function sampleEvent(overrides: Record<string, unknown> = {}) {
  return {
    api_version: "1.0",
    event: {
      id: "CD489E0E-5D52-4F24-A6CA-5C8A14A2B1E6",
      type: "INITIAL_PURCHASE",
      app_user_id: "$RCAnonymousID:87c6049c58069238dce29853916d624c",
      original_app_user_id: "$RCAnonymousID:87c6049c58069238dce29853916d624c",
      aliases: ["$RCAnonymousID:87c6049c58069238dce29853916d624c"],
      product_id: "com.aido.pro.yearly:yearly-base",
      period_type: "TRIAL",
      purchased_at_ms: PURCHASED_AT_MS,
      expiration_at_ms: EXPIRES_AT_MS,
      event_timestamp_ms: PURCHASED_AT_MS,
      environment: "PRODUCTION",
      store: "PLAY_STORE",
      transaction_id: "GPA.3309-9122-6177-47466..0",
      original_transaction_id: "GPA.3309-9122-6177-47466",
      is_family_share: false,
      country_code: "KR",
      currency: "KRW",
      price: 19.99,
      price_in_purchased_currency: 29_900,
      subscriber_attributes: {
        appVersion: { value: "1.15.0", updated_at_ms: PURCHASED_AT_MS },
        deviceModel: { value: "Pixel 9", updated_at_ms: PURCHASED_AT_MS },
      },
      ...overrides,
    },
  };
}

const PRODUCTION: RevenueCatTranslationOptions = { acceptsTestStore: false };
const LOCAL: RevenueCatTranslationOptions = { acceptsTestStore: true };

function translated(body: unknown, options = PRODUCTION) {
  const result = translateRevenueCatWebhook(body, options);
  if (result.status !== "translated") {
    throw new Error("번역되지 않았다");
  }
  return result.event;
}

describe("translateRevenueCatWebhook — RevenueCat 웹훅을 스토어 구독 이벤트로", () => {
  it("구매 예시를 공급자를 모르는 시작 이벤트로 빠짐없이 옮긴다", () => {
    // Given
    const body = sampleEvent();

    // When
    const event = translated(body);

    // Then
    expect(event).toEqual({
      provider: "REVENUECAT",
      providerEventId: "CD489E0E-5D52-4F24-A6CA-5C8A14A2B1E6",
      providerEventType: "INITIAL_PURCHASE",
      environment: "PRODUCTION",
      store: "PLAY_STORE",
      details: { countryCode: "KR", appVersion: "1.15.0", deviceModel: "Pixel 9" },
      appUserId: "$RCAnonymousID:87c6049c58069238dce29853916d624c",
      storeSubscriptionId: "GPA.3309-9122-6177-47466",
      productId: "com.aido.pro.yearly:yearly-base",
      periodEndsAt: Temporal.Instant.fromEpochMilliseconds(EXPIRES_AT_MS),
      periodKind: "TRIAL",
      price: { usd: 19.99, amountInPurchasedCurrency: 29_900, purchasedCurrency: "KRW" },
      kind: "STARTED",
      isOneTime: false,
      startedAt: Temporal.Instant.fromEpochMilliseconds(PURCHASED_AT_MS),
    });
  });

  it.each([
    { type: "INITIAL_PURCHASE", extra: {}, expected: { kind: "STARTED", isOneTime: false } },
    { type: "NON_RENEWING_PURCHASE", extra: {}, expected: { kind: "STARTED", isOneTime: true } },
    {
      type: "RENEWAL",
      extra: { is_trial_conversion: true },
      expected: { kind: "RENEWED", isTrialConversion: true },
    },
    {
      type: "CANCELLATION",
      extra: { cancel_reason: "UNSUBSCRIBE" },
      expected: { kind: "CANCELLED", reason: "UNSUBSCRIBE" },
    },
    // RevenueCat은 환불을 CANCELLATION + CUSTOMER_SUPPORT로 보낸다
    {
      type: "CANCELLATION",
      extra: { cancel_reason: "CUSTOMER_SUPPORT" },
      expected: { kind: "REFUNDED", reason: "CUSTOMER_SUPPORT" },
    },
    { type: "UNCANCELLATION", extra: {}, expected: { kind: "UNCANCELLED" } },
    {
      type: "EXPIRATION",
      extra: { expiration_reason: "BILLING_ERROR" },
      expected: { kind: "EXPIRED", reason: "BILLING_ERROR" },
    },
    {
      type: "BILLING_ISSUE",
      extra: { grace_period_expiration_at_ms: EXPIRES_AT_MS },
      expected: {
        kind: "BILLING_ISSUE",
        gracePeriodEndsAt: Temporal.Instant.fromEpochMilliseconds(EXPIRES_AT_MS),
      },
    },
    {
      type: "PRODUCT_CHANGE",
      extra: { new_product_id: "com.aido.pro.monthly:monthly-base" },
      expected: {
        kind: "PRODUCT_CHANGE_SCHEDULED",
        newProductId: "com.aido.pro.monthly:monthly-base",
      },
    },
    { type: "SUBSCRIPTION_EXTENDED", extra: {}, expected: { kind: "EXTENDED" } },
    { type: "TEST", extra: {}, expected: { kind: "IGNORED" } },
    { type: "SUBSCRIBER_ALIAS", extra: {}, expected: { kind: "IGNORED" } },
  ])("$type → $expected.kind", ({ type, extra, expected }) => {
    // Given
    const body = sampleEvent({ type, ...extra });

    // When
    const event = translated(body);

    // Then
    expect(event).toMatchObject(expected);
  });

  it("빠진 시각(0)은 비우고, 원 거래 ID가 없으면 거래 ID로 체인을 찾는다", () => {
    // Given
    const body = sampleEvent({
      purchased_at_ms: 0,
      expiration_at_ms: 0,
      original_transaction_id: undefined,
    });

    // When
    const event = translated(body);

    // Then
    expect(event).toMatchObject({
      storeSubscriptionId: "GPA.3309-9122-6177-47466..0",
      periodEndsAt: undefined,
      startedAt: undefined,
    });
  });

  it.each([
    { store: "RC_BILLING", expected: "WEB_BILLING" },
    { store: "APP_STORE", expected: "APP_STORE" },
    { store: "FUTURE_STORE", expected: null },
  ])("스토어 $store는 $expected다", ({ store, expected }) => {
    // Given
    const body = sampleEvent({ store });

    // When
    const event = translated(body);

    // Then
    expect(event.store).toBe(expected);
  });

  it("문서의 TRANSFER 예시는 넘겨받은·넘겨준 사용자만 가진 이전 이벤트다", () => {
    // Given
    const body = {
      api_version: "1.0",
      event: {
        id: "E4E19B7A-1B8D-4E5E-B5C6-6E3E1C2B9C11",
        type: "TRANSFER",
        event_timestamp_ms: PURCHASED_AT_MS,
        environment: "PRODUCTION",
        store: "APP_STORE",
        transferred_from: ["old-user"],
        transferred_to: ["new-user"],
      },
    };

    // When
    const event = translated(body);

    // Then
    expect(event).toEqual({
      provider: "REVENUECAT",
      providerEventId: "E4E19B7A-1B8D-4E5E-B5C6-6E3E1C2B9C11",
      providerEventType: "TRANSFER",
      environment: "PRODUCTION",
      store: "APP_STORE",
      details: {},
      kind: "TRANSFERRED",
      receivers: ["new-user"],
      transferredFrom: ["old-user"],
    });
  });

  it("형식이 다른 부가 정보는 그 필드만 버린다", () => {
    // Given
    const body = sampleEvent({ subscriber_attributes: { appVersion: "1.15.0" } });

    // When
    const event = translated(body);

    // Then
    expect(event.details).toEqual({ countryCode: "KR" });
  });

  it.each([
    { body: null, eventType: undefined },
    { body: { event: { type: "INITIAL_PURCHASE" } }, eventType: "INITIAL_PURCHASE" },
  ])("검증할 수 없는 원문은 처리하지 않고 이벤트 이름만 알린다", ({ body, eventType }) => {
    // Given
    const raw = body;

    // When
    const result = translateRevenueCatWebhook(raw, PRODUCTION);

    // Then
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" ? result.eventType : null).toBe(eventType);
  });

  it.each([
    {
      name: "구매",
      body: sampleEvent({ store: "TEST_STORE", environment: "SANDBOX" }),
      expected: {
        status: "skipped",
        reason: "TEST_STORE",
        eventType: "INITIAL_PURCHASE",
        eventId: "CD489E0E-5D52-4F24-A6CA-5C8A14A2B1E6",
      },
    },
    {
      name: "형식이 틀린 원문",
      body: { event: { type: "INITIAL_PURCHASE", store: "TEST_STORE" } },
      expected: { status: "skipped", reason: "TEST_STORE", eventType: "INITIAL_PURCHASE" },
    },
  ])("Test Store를 받지 않으면 $name도 구독 이벤트로 바꾸지 않는다", ({ body, expected }) => {
    // Given
    const raw = body;

    // When
    const result = translateRevenueCatWebhook(raw, PRODUCTION);

    // Then
    expect(result).toEqual(expected);
  });

  it("Test Store를 받지 않아도 App Store SANDBOX 구매는 그대로 시작 이벤트다", () => {
    // Given
    const body = sampleEvent({ store: "APP_STORE", environment: "SANDBOX" });

    // When
    const event = translated(body, PRODUCTION);

    // Then
    expect(event).toMatchObject({ kind: "STARTED", store: "APP_STORE", environment: "SANDBOX" });
  });

  it("Test Store를 받으면 Test Store 구매도 시작 이벤트로 옮긴다", () => {
    // Given
    const body = sampleEvent({ store: "TEST_STORE", environment: "SANDBOX" });

    // When
    const event = translated(body, LOCAL);

    // Then
    expect(event).toMatchObject({ kind: "STARTED", store: null, environment: "SANDBOX" });
  });
});
