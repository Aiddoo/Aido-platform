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

import { PAYMENT_NOTIFIER } from "#api/modules/operations/operations-notifications.public";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { SUBSCRIPTION_TIME } from "#test/fixtures/subscription.fixture";
import { FakeAdminNotifier } from "#test/mocks/fake-admin-notifier";

import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

const captureException = vi.mocked(Sentry.captureException);

describe("SubscriptionEventNotifierAdapter — 웹훅 실패 보고", () => {
  let adapter: SubscriptionEventNotifierAdapter;
  let notifier: FakeAdminNotifier;
  let payload: ReturnType<SubscriptionEventBuilder["build"]>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    notifier = new FakeAdminNotifier();
    payload = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId("user-123")
      .withProductId("premium_monthly")
      .build();

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
    adapter.reportWebhookFailure(error, payload);

    // Then — 컨트롤러에서 옮겨온 태그/extra 그대로 유지
    expect(mockScope.setTag).toHaveBeenCalledWith("domain", "payment");
    expect(mockScope.setTag).toHaveBeenCalledWith("webhook.event_type", "INITIAL_PURCHASE");
    expect(mockScope.setTag).toHaveBeenCalledWith("webhook.store", "APP_STORE");
    expect(mockScope.setExtra).toHaveBeenCalledWith("webhook.app_user_id", "user-123");
    expect(mockScope.setExtra).toHaveBeenCalledWith("webhook.product_id", "premium_monthly");
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("Discord로 에러 메시지를 전송한다 (제목·색·필드 byte-identical)", async () => {
    // Given
    const error = new Error("Processing failed");

    // When
    adapter.reportWebhookFailure(error, payload);

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
    expect(() => adapter.reportWebhookFailure(new Error("x"), payload)).not.toThrow();
    await vi.waitFor(() => expect(Logger.prototype.warn).toHaveBeenCalledTimes(1));
  });
});
