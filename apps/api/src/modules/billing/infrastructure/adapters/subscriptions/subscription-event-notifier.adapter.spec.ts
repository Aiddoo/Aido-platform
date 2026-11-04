import { vi } from "vitest";
/**
 * SubscriptionEventNotifierAdapter 단위 테스트
 *
 * 웹훅 실패 보고(reportWebhookFailure)의 Sentry 태깅·운영 경보를 검증한다.
 * Sentry SDK는 벤더 경계라 vi.mock으로 격리한다(프로젝트 규칙 — vendor/native만 허용).
 * withScope는 팩토리에서 즉시 콜백을 호출해 mockScope로 태깅을 관측한다.
 */
const mockScope = { setTag: vi.fn(), setExtra: vi.fn() };
vi.mock("@sentry/nestjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
}));

import * as Sentry from "@sentry/nestjs";
import { TestBed } from "@suites/unit";

import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { SUBSCRIPTION_TIME } from "#test/fixtures/subscription.fixture";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import type { WebhookFailureContext } from "../../../application/ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../../application/types/subscriptions/subscription-event.payload.js";
import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

const captureException = vi.mocked(Sentry.captureException);

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
      appUserId: "user-123",
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
    vi.clearAllMocks();
  });

  it("Sentry에 결제 도메인 컨텍스트를 태깅해 캡처한다", () => {
    // Given
    const error = new Error("Processing failed");

    // When
    adapter.reportWebhookFailure(error, context);

    // Then — 컨트롤러에서 옮겨온 태그/extra 그대로 유지
    expect(mockScope.setTag).toHaveBeenCalledWith("domain", "payment");
    expect(mockScope.setTag).toHaveBeenCalledWith("webhook.event_type", "INITIAL_PURCHASE");
    expect(mockScope.setTag).toHaveBeenCalledWith("webhook.store", "APP_STORE");
    expect(mockScope.setExtra).toHaveBeenCalledWith("webhook.app_user_id", "user-1…");
    expect(mockScope.setExtra).toHaveBeenCalledWith("webhook.product_id", "premium_monthly");
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("운영 경보에는 이벤트 식별자만 싣고 오류 원문·사용자 id는 싣지 않는다", () => {
    // Given
    const error = new Error("private-provider-message user-123");

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(alerts.alerts).toEqual([
      {
        key: "billing.subscription.webhook.processing-failed",
        severity: "error",
        message: "RevenueCat 웹훅 처리에 실패했습니다",
        tags: { eventType: "INITIAL_PURCHASE", store: "APP_STORE" },
        details: { eventId: "evt-1", productId: "premium_monthly" },
      },
    ]);
    expect(JSON.stringify(alerts.alerts)).not.toContain("private-provider-message");
    expect(JSON.stringify(alerts.alerts)).not.toContain("user-123");
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
