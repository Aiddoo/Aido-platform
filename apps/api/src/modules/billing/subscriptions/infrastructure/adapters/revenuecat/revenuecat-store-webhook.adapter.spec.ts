import { Logger } from "@nestjs/common";

import type { AppEnvironment } from "#api/platform/config/schemas/app.schema";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { billingSubscriptionsConfig } from "../../../billing-subscriptions.config.js";
import { RevenueCatStoreWebhookAdapter } from "./revenuecat-store-webhook.adapter.js";

function adapterFor(env: Readonly<Record<string, string | undefined>>) {
  const alert = new RecordingOperationalAlert();
  const adapter = new RevenueCatStoreWebhookAdapter(alert, billingSubscriptionsConfig.parse(env));
  return { adapter, alert };
}

function headersWith(authorization?: string) {
  return authorization == null ? {} : { authorization };
}

function purchase(store: string) {
  return {
    api_version: "1.0",
    event: {
      id: "5B2F3C1E-8A41-4C0B-9D7E-2F7A1C9B3E10",
      type: "INITIAL_PURCHASE",
      app_user_id: "local-dev-user",
      product_id: "com.aido.pro.monthly",
      purchased_at_ms: 1_591_121_853_000,
      expiration_at_ms: 1_591_726_653_000,
      environment: "SANDBOX",
      store,
      original_transaction_id: "test-store-transaction",
    },
  };
}

function adapterIn(appEnv: AppEnvironment) {
  return adapterFor({ NODE_ENV: "production", APP_ENV: appEnv });
}

describe("RevenueCatStoreWebhookAdapter — 웹훅 인증", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  describe("webhook secret이 설정된 운영", () => {
    const { adapter } = adapterFor({
      NODE_ENV: "production",
      APP_ENV: "production",
      REVENUECAT_WEBHOOK_SECRET: "test-secret",
    });

    it("Bearer를 붙인 올바른 Authorization은 통과한다", () => {
      // When
      const allowed = adapter.authenticate(headersWith("Bearer test-secret"));

      // Then
      expect(allowed).toBe(true);
    });

    it("Bearer 없이 보낸 올바른 값도 통과한다", () => {
      // When
      const allowed = adapter.authenticate(headersWith("test-secret"));

      // Then
      expect(allowed).toBe(true);
    });

    it.each([
      { name: "Authorization 없음", authorization: undefined },
      { name: "다른 값", authorization: "Bearer wrong-secret" },
      { name: "길이가 다른 값", authorization: "Bearer short" },
    ])("$name은 거절한다", ({ authorization }) => {
      // When
      const allowed = adapter.authenticate(headersWith(authorization));

      // Then
      expect(allowed).toBe(false);
    });
  });

  it.each([
    { name: "로컬 개발", env: { NODE_ENV: "development" } },
    { name: "배포된 개발서버", env: { NODE_ENV: "production", APP_ENV: "development" } },
  ])("$name은 secret이 없으면 검증을 건너뛰고 통과시킨다", ({ env }) => {
    // Given
    const { adapter } = adapterFor(env);

    // When
    const allowed = adapter.authenticate(headersWith());

    // Then
    expect(allowed).toBe(true);
  });

  it.each([
    { name: "스테이징", env: { NODE_ENV: "production", APP_ENV: "staging" } },
    { name: "운영", env: { NODE_ENV: "production", APP_ENV: "production" } },
    { name: "APP_ENV 없는 운영", env: { NODE_ENV: "production" } },
    {
      name: "빈 문자열 secret의 운영",
      env: { NODE_ENV: "production", APP_ENV: "production", REVENUECAT_WEBHOOK_SECRET: "" },
    },
  ])("$name은 secret이 없으면 Authorization을 보내도 모두 거절한다", ({ env }) => {
    // Given
    const { adapter } = adapterFor(env);

    // When
    const allowed = adapter.authenticate(headersWith("Bearer anything"));

    // Then
    expect(allowed).toBe(false);
  });
});

describe("RevenueCatStoreWebhookAdapter — Test Store 웹훅", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  it("운영은 Test Store 구매를 반영하지 않고 경보 없이 받은 것으로 닫는다", () => {
    // Given
    const { adapter, alert } = adapterIn("production");

    // When
    const event = adapter.translate(purchase("TEST_STORE"));

    // Then
    expect(event).toBeNull();
    expect(alert.alerts).toEqual([]);
    expect(Logger.prototype.log).toHaveBeenCalledExactlyOnceWith({
      event: "billing.subscription.webhook.skipped",
      reason: "TEST_STORE",
      eventType: "INITIAL_PURCHASE",
      eventId: "5B2F3C1E-8A41-4C0B-9D7E-2F7A1C9B3E10",
    });
  });

  it("운영도 App Store SANDBOX 구매는 반영한다", () => {
    // Given
    const { adapter, alert } = adapterIn("production");

    // When
    const event = adapter.translate(purchase("APP_STORE"));

    // Then
    expect(event).toMatchObject({ kind: "STARTED", store: "APP_STORE", environment: "SANDBOX" });
    expect(alert.alerts).toEqual([]);
  });

  it.each(["development", "staging"] as const)(
    "%s 서버는 Test Store 구매를 지금처럼 반영한다",
    (environment) => {
      // Given
      const { adapter } = adapterIn(environment);

      // When
      const event = adapter.translate(purchase("TEST_STORE"));

      // Then
      expect(event).toMatchObject({ kind: "STARTED", environment: "SANDBOX" });
    },
  );
});
