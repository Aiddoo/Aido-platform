import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";

import { defineAlerts } from "#api/shared/application/alerts/define-alerts";
import { ApplicationException } from "#api/shared/application/application.exception";

import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

const sentry = vi.hoisted(() => ({
  withScope: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/nestjs", () => sentry);

const scope = {
  setFingerprint: vi.fn(),
  setTransactionName: vi.fn(),
  setTags: vi.fn(),
  setExtras: vi.fn(),
  setExtra: vi.fn(),
  setLevel: vi.fn(),
};

const VendorAlerts = defineAlerts("vendor", {
  BILLING_FAILED: {
    key: "vendor.billing.failed",
    severity: "error",
    summary: "결제 실패",
    runbook: "결제 수단을 확인한다",
  },
});

describe("SentryOperationalAlertAdapter", () => {
  beforeEach(() => {
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("경보 key를 fingerprint로 고정하고 카탈로그 정보를 고정 태그로 싣는다", () => {
    // When
    new SentryOperationalAlertAdapter().raise({
      ...VendorAlerts.BILLING_FAILED,
      tags: { policy: "vendor", alert_key: "덮어쓰기 시도" },
      details: { cooldownMs: 1 },
    });

    // Then
    expect(scope.setFingerprint).toHaveBeenCalledWith(["vendor.billing.failed"]);
    expect(scope.setTransactionName).toHaveBeenCalledWith("vendor.billing.failed");
    expect(scope.setTags).toHaveBeenLastCalledWith({
      alert_key: "vendor.billing.failed",
      alert_context: "vendor",
      severity: "error",
    });
    expect(scope.setExtras).toHaveBeenCalledWith({
      cooldownMs: 1,
      runbook: "결제 수단을 확인한다",
    });
    expect(sentry.captureMessage).toHaveBeenCalledWith("결제 실패", "error");
  });

  it("원인 예외가 있으면 같은 이슈로 모으면서 스택을 남긴다", () => {
    // Given
    const cause = new Error("webhook failed");

    // When
    new SentryOperationalAlertAdapter().raise({ ...VendorAlerts.BILLING_FAILED, cause });

    // Then
    expect(scope.setFingerprint).toHaveBeenCalledWith(["vendor.billing.failed"]);
    expect(scope.setLevel).toHaveBeenCalledWith("error");
    expect(sentry.captureException).toHaveBeenCalledWith(cause);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("웹훅 영구 실패처럼 업무 거부가 원인이면 예외가 아니라 경보 문장과 오류 코드로 보낸다", () => {
    // Given - 없는 구독 사용자(404)로 닫은 RevenueCat 웹훅
    const cause = new ApplicationException(ErrorCode.SUBSCRIPTION_1602);

    // When
    new SentryOperationalAlertAdapter().raise({ ...VendorAlerts.BILLING_FAILED, cause });

    // Then
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).toHaveBeenCalledWith("결제 실패", "error");
    expect(scope.setExtra).toHaveBeenCalledWith("errorCode", ErrorCode.SUBSCRIPTION_1602);
  });

  it("Sentry가 실패해도 호출 흐름으로 던지지 않고 경고만 남긴다", () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    sentry.withScope.mockImplementation(() => {
      throw new TypeError("sentry down");
    });

    // When
    const raise = () => new SentryOperationalAlertAdapter().raise(VendorAlerts.BILLING_FAILED);

    // Then
    expect(raise).not.toThrow();
    expect(warn).toHaveBeenCalledWith({
      event: "observability.alert.failed",
      alertKey: "vendor.billing.failed",
      errorType: "TypeError",
    });
  });
});
