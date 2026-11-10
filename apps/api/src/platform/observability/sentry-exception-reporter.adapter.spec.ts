import { Logger } from "@nestjs/common";

import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";

const sentry = vi.hoisted(() => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/nestjs", () => sentry);

const scope = { setUser: vi.fn(), setTags: vi.fn(), setExtra: vi.fn() };

describe("SentryExceptionReporter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("사용자 ID·태그·추가 정보를 같은 scope에 싣고 예외를 보낸다", () => {
    // Given
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );
    const error = new Error("boom");

    // When
    new SentryExceptionReporter().report(error, {
      userId: "user-1",
      tags: { "error.code": "SYS_0001" },
      extras: { errorResponse: { success: false } },
    });

    // Then
    expect(scope.setUser).toHaveBeenCalledWith({ id: "user-1" });
    expect(scope.setTags).toHaveBeenCalledWith({ "error.code": "SYS_0001" });
    expect(scope.setExtra).toHaveBeenCalledWith("errorResponse", { success: false });
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("익명 요청은 사용자를 비운다", () => {
    // Given
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );

    // When
    new SentryExceptionReporter().report(new Error("boom"), { userId: null, tags: {} });

    // Then
    expect(scope.setUser).toHaveBeenCalledWith(null);
  });

  it("Sentry가 실패해도 던지지 않고 경고만 남긴다", () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    sentry.withScope.mockImplementation(() => {
      throw new TypeError("sentry down");
    });

    // When
    const report = () =>
      new SentryExceptionReporter().report(new Error("boom"), { userId: null, tags: {} });

    // Then
    expect(report).not.toThrow();
    expect(warn).toHaveBeenCalledWith({
      event: "observability.exception-report.failed",
      errorType: "TypeError",
    });
  });
});
