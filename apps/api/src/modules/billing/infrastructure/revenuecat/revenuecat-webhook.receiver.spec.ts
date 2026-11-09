import { Logger } from "@nestjs/common";

import type { TypedConfigService } from "#api/platform/config/services/config.service";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import type { StoreSubscriptionEvent } from "../../application/types/subscriptions/store-subscription-event.js";
import { RevenueCatWebhookReceiver } from "./revenuecat-webhook.receiver.js";

class RecordingStoreSubscriptionEvents {
  readonly applied: StoreSubscriptionEvent[] = [];

  async execute(event: StoreSubscriptionEvent): Promise<void> {
    this.applied.push(event);
  }
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

function receiverIn(appEnv: TypedConfigService["appEnv"]) {
  const events = new RecordingStoreSubscriptionEvents();
  const alert = new RecordingOperationalAlert();
  const receiver = new RevenueCatWebhookReceiver(events, alert, { appEnv });
  return { receiver, events, alert };
}

describe("RevenueCatWebhookReceiver — Test Store 웹훅", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  it("운영은 Test Store 구매를 반영하지 않고 경보 없이 받은 것으로 닫는다", async () => {
    // Given
    const { receiver, events, alert } = receiverIn("production");

    // When
    const response = await receiver.receive({ body: purchase("TEST_STORE") });

    // Then
    expect(response).toEqual({ received: true });
    expect(events.applied).toEqual([]);
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
    const { receiver, events, alert } = receiverIn("production");

    // When
    await receiver.receive({ body: purchase("APP_STORE") });

    // Then
    expect(events.applied).toMatchObject([
      { kind: "STARTED", store: "APP_STORE", environment: "SANDBOX" },
    ]);
    expect(alert.alerts).toEqual([]);
  });

  it.each(["development", "staging"] as const)(
    "%s 서버는 Test Store 구매를 지금처럼 반영한다",
    async (appEnv) => {
      // Given
      const { receiver, events } = receiverIn(appEnv);

      // When
      await receiver.receive({ body: purchase("TEST_STORE") });

      // Then
      expect(events.applied).toMatchObject([{ kind: "STARTED", environment: "SANDBOX" }]);
    },
  );
});
