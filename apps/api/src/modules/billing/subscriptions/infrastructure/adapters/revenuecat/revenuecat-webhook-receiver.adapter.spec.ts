import { Logger } from "@nestjs/common";

import type { AppEnvironment } from "#api/platform/config/schemas/app.schema";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { ApplyStoreSubscriptionEventUseCase } from "../../../application/use-cases/apply-store-subscription-event.use-case.js";
import { billingSubscriptionsConfig } from "../../../billing-subscriptions.config.js";
import type { StoreSubscriptionEvent } from "../../../domain/store-subscription.event.js";
import { RevenueCatWebhookReceiver } from "./revenuecat-webhook-receiver.adapter.js";

// UseCase 의존성을 만들지 않고 execute만 기록하도록 바꾼 인스턴스다
function recordingApplyUseCase(
  applied: StoreSubscriptionEvent[],
): ApplyStoreSubscriptionEventUseCase {
  const useCase: ApplyStoreSubscriptionEventUseCase = Object.create(
    ApplyStoreSubscriptionEventUseCase.prototype,
  );
  vi.spyOn(useCase, "execute").mockImplementation(async (event) => {
    applied.push(event);
  });
  return useCase;
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

function receiverIn(appEnv: AppEnvironment) {
  const applied: StoreSubscriptionEvent[] = [];
  const alert = new RecordingOperationalAlert();
  const config = billingSubscriptionsConfig.parse({ NODE_ENV: "production", APP_ENV: appEnv });
  const receiver = new RevenueCatWebhookReceiver(recordingApplyUseCase(applied), alert, config);
  return { receiver, applied, alert };
}

describe("RevenueCatWebhookReceiver — Test Store 웹훅", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  it("운영은 Test Store 구매를 반영하지 않고 경보 없이 받은 것으로 닫는다", async () => {
    // Given
    const { receiver, applied, alert } = receiverIn("production");

    // When
    const response = await receiver.receive({ body: purchase("TEST_STORE") });

    // Then
    expect(response).toEqual({ received: true });
    expect(applied).toEqual([]);
    expect(alert.alerts).toEqual([]);
    expect(Logger.prototype.log).toHaveBeenCalledExactlyOnceWith({
      event: "billing.subscription.webhook.skipped",
      reason: "TEST_STORE",
      eventType: "INITIAL_PURCHASE",
      eventId: "5B2F3C1E-8A41-4C0B-9D7E-2F7A1C9B3E10",
    });
  });

  it("운영도 App Store SANDBOX 구매는 반영한다", async () => {
    // Given
    const { receiver, applied, alert } = receiverIn("production");

    // When
    await receiver.receive({ body: purchase("APP_STORE") });

    // Then
    expect(applied).toMatchObject([
      { kind: "STARTED", store: "APP_STORE", environment: "SANDBOX" },
    ]);
    expect(alert.alerts).toEqual([]);
  });

  it.each(["development", "staging"] as const)(
    "%s 서버는 Test Store 구매를 지금처럼 반영한다",
    async (environment) => {
      // Given
      const { receiver, applied } = receiverIn(environment);

      // When
      await receiver.receive({ body: purchase("TEST_STORE") });

      // Then
      expect(applied).toMatchObject([{ kind: "STARTED", environment: "SANDBOX" }]);
    },
  );
});
