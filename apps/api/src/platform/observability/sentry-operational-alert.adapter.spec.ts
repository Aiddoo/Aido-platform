import { Logger } from "@nestjs/common";

import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

const sentry = vi.hoisted(() => ({ withScope: vi.fn(), captureMessage: vi.fn() }));

vi.mock("@sentry/nestjs", () => sentry);

const scope = { setFingerprint: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setExtras: vi.fn() };

describe("SentryOperationalAlertAdapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("경보 key를 fingerprint로 고정해 같은 상황을 한 이슈로 모은다", () => {
    // Given
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );
    // When
    new SentryOperationalAlertAdapter().raise({
      key: "vendor.billing",
      severity: "warning",
      message: "결제 실패",
      tags: { policy: "vendor" },
      details: { cooldownMs: 1 },
    });
    // Then
    expect(scope.setFingerprint).toHaveBeenCalledWith(["vendor.billing"]);
    expect(scope.setTags).toHaveBeenCalledWith({ policy: "vendor" });
    expect(scope.setExtras).toHaveBeenCalledWith({ cooldownMs: 1 });
    expect(sentry.captureMessage).toHaveBeenCalledWith("결제 실패", "warning");
  });

  it("Sentry가 실패해도 호출 흐름으로 던지지 않고 경고만 남긴다", () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    sentry.withScope.mockImplementation(() => {
      throw new TypeError("sentry down");
    });
    // When
    const raise = () =>
      new SentryOperationalAlertAdapter().raise({
        key: "vendor.billing",
        severity: "error",
        message: "결제 실패",
      });
    // Then
    expect(raise).not.toThrow();
    expect(warn).toHaveBeenCalledWith({
      event: "observability.alert.failed",
      alertKey: "vendor.billing",
      errorType: "TypeError",
    });
  });
});
