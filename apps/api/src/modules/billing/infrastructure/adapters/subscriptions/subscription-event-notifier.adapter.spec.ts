import { ErrorCode } from "@aido/api/errors";
import { TestBed } from "@suites/unit";
import { vi } from "vitest";

import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { SUBSCRIPTION_TIME } from "#test/fixtures/subscription.fixture";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import type { WebhookFailureContext } from "../../../application/ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../../application/types/subscriptions/subscription-event.payload.js";
import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

describe("SubscriptionEventNotifierAdapter — 웹훅 실패 보고", () => {
  let adapter: SubscriptionEventNotifierAdapter;
  let alerts: RecordingOperationalAlert;
  let context: WebhookFailureContext;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
    alerts = new RecordingOperationalAlert();
    context = {
      eventType: "INITIAL_PURCHASE",
      eventId: "evt-1",
      store: "APP_STORE",
      productId: "premium_monthly",
    };

    const { unit } = await TestBed.solitary(SubscriptionEventNotifierAdapter)
      .mock(OPERATIONAL_ALERT)
      .final(alerts)
      .compile();

    adapter = unit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("경보 태그와 세부 값에는 이벤트 식별자와 오류 종류만 싣고 스택은 원인 예외로 넘긴다", () => {
    // Given
    const error = new TypeError("private-provider-message user-123");

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(alerts.alerts).toEqual([
      {
        key: "billing.subscription.webhook.processing-failed",
        severity: "error",
        message: "RevenueCat 웹훅 처리에 실패했습니다",
        tags: { eventType: "INITIAL_PURCHASE", store: "APP_STORE" },
        details: {
          eventId: "evt-1",
          productId: "premium_monthly",
          errorType: "TypeError",
          errorCode: null,
        },
        cause: error,
      },
    ]);
    expect(JSON.stringify(alerts.alerts)).not.toContain("private-provider-message");
    expect(JSON.stringify(alerts.alerts)).not.toContain("user-123");
  });

  it("오류 코드가 있는 실패는 코드도 경보에 싣는다", () => {
    // Given
    const error = new ApplicationException(ErrorCode.SUBSCRIPTION_1602);

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(alerts.alerts[0]?.details).toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1602 });
  });

  it("스토어·이벤트 id가 없는 웹훅도 경보를 올린다", () => {
    // Given
    const transfer: WebhookFailureContext = { eventType: "TRANSFER" };

    // When
    adapter.reportWebhookFailure(new Error("x"), transfer);

    // Then
    expect(alerts.alerts[0]).toMatchObject({
      tags: { eventType: "TRANSFER", store: "unknown" },
      details: { eventId: null, productId: null },
    });
  });

  describe("구독 이벤트 운영 알림", () => {
    async function adapterWithProjectId(projectId: string | undefined) {
      const forwarded: SubscriptionEventPayload[] = [];
      const { unit } = await TestBed.solitary(SubscriptionEventNotifierAdapter)
        .mock(AdminEventNotifier)
        .impl(() => ({
          notifySubscriptionEvent: (event: SubscriptionEventPayload) => forwarded.push(event),
        }))
        .mock(TypedConfigService)
        .final({ revenuecat: { secretApiKey: undefined, webhookSecret: undefined, projectId } })
        .compile();
      return { unit, forwarded };
    }

    const event: SubscriptionEventPayload = {
      userId: "user-1",
      email: "user@example.com",
      eventType: "INITIAL_PURCHASE",
      productId: "premium_monthly",
      appUserId: "app user/1",
    };

    it("프로젝트 ID가 있으면 RevenueCat 고객 화면 주소를 붙여 넘긴다", async () => {
      // Given
      const { unit, forwarded } = await adapterWithProjectId("6a6ea506");

      // When
      unit.notifySubscriptionEvent(event);

      // Then
      expect(forwarded[0]?.revenueCatCustomerUrl).toBe(
        "https://app.revenuecat.com/projects/6a6ea506/customers/app%20user%2F1",
      );
    });

    it("프로젝트 ID가 없으면 받은 그대로 넘긴다", async () => {
      // Given
      const { unit, forwarded } = await adapterWithProjectId(undefined);

      // When
      unit.notifySubscriptionEvent(event);

      // Then
      expect(forwarded).toEqual([event]);
    });
  });
});
