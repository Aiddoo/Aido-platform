import { Logger } from "@nestjs/common";

import {
  EXCEPTION_REPORT_THRESHOLD,
  EXCEPTION_REPORT_WINDOW_MS,
  SentryExceptionReporter,
} from "./sentry-exception-reporter.adapter.js";

const sentry = vi.hoisted(() => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/nestjs", () => sentry);

const scope = { setUser: vi.fn(), setTags: vi.fn(), setExtra: vi.fn(), setFingerprint: vi.fn() };

describe("SentryExceptionReporter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it("분류 키가 있으면 스택과 상관없이 그 키로 한 이슈에 모은다", () => {
    // Given
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );

    // When
    new SentryExceptionReporter().report(new Error("ai down"), {
      userId: null,
      tags: {},
      groupKey: "http-5xx.AI_1301",
    });

    // Then
    expect(scope.setFingerprint).toHaveBeenCalledWith(["http-5xx.AI_1301"]);
  });

  it("같은 경로·오류 코드 예외는 한 시간에 기준 건수까지만 보내고 다음 시간에 다시 보낸다", () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    sentry.withScope.mockImplementation((callback: (current: typeof scope) => void) =>
      callback(scope),
    );
    const reporter = new SentryExceptionReporter();
    const context = { userId: null, tags: { "http.route": "/v1/todos", "error.code": "SYS_0001" } };

    // When
    for (let index = 0; index <= EXCEPTION_REPORT_THRESHOLD; index++) {
      reporter.report(new Error("boom"), context);
    }
    vi.setSystemTime(EXCEPTION_REPORT_WINDOW_MS);
    reporter.report(new Error("boom"), context);

    // Then
    expect(sentry.captureException).toHaveBeenCalledTimes(EXCEPTION_REPORT_THRESHOLD + 1);
  });
});
