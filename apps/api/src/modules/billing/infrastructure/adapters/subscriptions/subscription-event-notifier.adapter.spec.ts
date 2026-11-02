import { vi } from "vitest";
/**
 * SubscriptionEventNotifierAdapter 단위 테스트
 *
 * 웹훅 실패 보고(reportWebhookFailure)의 Sentry 태깅·Discord 메시지 형식을 검증한다.
 * Sentry SDK는 벤더 경계라 vi.mock으로 격리한다(프로젝트 규칙 — vendor/native만 허용).
 * withScope는 팩토리에서 즉시 콜백을 호출해 mockScope로 태깅을 관측한다.
 */
const mockScope = { setTag: vi.fn(), setExtra: vi.fn() };
vi.mock("@sentry/nestjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: typeof mockScope) => void) => cb(mockScope)),
}));

import { Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { TestBed } from "@suites/unit";

import {
  AdminEventNotifier,
  PAYMENT_NOTIFIER,
} from "#api/modules/operations/operations-notifications.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { SUBSCRIPTION_TIME } from "#test/fixtures/subscription.fixture";
import { FakeAdminNotifier } from "#test/mocks/fake-admin-notifier";

import type { WebhookFailureContext } from "../../../application/ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../../application/types/subscriptions/subscription-event.payload.js";
import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

const captureException = vi.mocked(Sentry.captureException);

describe("SubscriptionEventNotifierAdapter — 웹훅 실패 보고", () => {
  let adapter: SubscriptionEventNotifierAdapter;
  let notifier: FakeAdminNotifier;
  let context: WebhookFailureContext;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    notifier = new FakeAdminNotifier();
    context = {
      eventType: "INITIAL_PURCHASE",
      eventId: "evt-1",
      store: "APP_STORE",
      appUserId: "user-123",
      productId: "premium_monthly",
    };

    const { unit } = await TestBed.solitary(SubscriptionEventNotifierAdapter)
      .mock(PAYMENT_NOTIFIER)
      .impl(() => notifier)
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

  it("Discord로 에러 메시지를 전송한다 (제목·색·필드 byte-identical)", async () => {
    // Given
    const error = new Error("Processing failed");

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(notifier.getSentNotifications()).toEqual([
      expect.objectContaining({
        title: "Webhook 처리 에러",
        body: "RevenueCat 웹훅 처리 중 에러가 발생했습니다.",
        color: 0xff0000,
        fields: expect.arrayContaining([
          expect.objectContaining({ name: "에러", value: "Processing failed" }),
          expect.objectContaining({
            name: "이벤트 타입",
            value: "INITIAL_PURCHASE",
          }),
          expect.objectContaining({ name: "사용자 ID", value: "user-123" }),
          expect.objectContaining({ name: "상품", value: "premium_monthly" }),
        ]),
      }),
    ]);
  });

  it("Discord 전송 실패는 삼킨다 (호출자에 전파 없음)", async () => {
    // Given
    vi.spyOn(notifier, "send").mockRejectedValueOnce(new Error("Discord down"));

    // When & Then — 동기 호출은 throw하지 않는다
    expect(() => adapter.reportWebhookFailure(new Error("x"), context)).not.toThrow();
    await vi.waitFor(() => expect(Logger.prototype.warn).toHaveBeenCalledTimes(1));
  });

  describe("구독 이벤트 운영 알림", () => {
    async function adapterWithProjectId(projectId: string | undefined) {
      const forwarded: SubscriptionEventPayload[] = [];
      const { unit } = await TestBed.solitary(SubscriptionEventNotifierAdapter)
        .mock(PAYMENT_NOTIFIER)
        .impl(() => notifier)
        .mock(AdminEventNotifier)
        .impl(() => ({
          notifySubscriptionEvent: (event: SubscriptionEventPayload) => forwarded.push(event),
        }))
        .mock(TypedConfigService)
        .impl((stubFn) => ({ get: stubFn().mockReturnValue(projectId) }))
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
