import { type DynamicModule, Logger, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { appConfig } from "#api/platform/config/app.config";
import { sentryConfig } from "#api/platform/config/sentry.config";
import { defineAlerts } from "#api/shared/application/alerts/define-alerts";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";

import { AlertingModule } from "./alerting.module.js";
import { DeduplicatingOperationalAlertAdapter } from "./deduplicating-operational-alert.adapter.js";
import { LogExceptionReporterAdapter } from "./log-exception-reporter.adapter.js";
import { NoopJobHeartbeatAdapter } from "./noop-job-heartbeat.adapter.js";
import type { ObservabilitySettings } from "./observability-backend.js";
import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";
import { SentryJobHeartbeatAdapter } from "./sentry-job-heartbeat.adapter.js";

const sentry = vi.hoisted(() => ({
  withScope: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  withMonitor: vi.fn(),
}));

vi.mock("@sentry/nestjs", () => sentry);

const DSN = "https://public@o0.ingest.sentry.io/0";

@Module({})
class ConfigStubModule {
  static with(settings: ObservabilitySettings): DynamicModule {
    return {
      module: ConfigStubModule,
      global: true,
      providers: [
        { provide: appConfig.KEY, useValue: settings.app },
        { provide: sentryConfig.KEY, useValue: settings.sentry },
        {
          provide: ClockPort,
          useValue: new FixedClock(Temporal.Instant.from("2026-11-10T00:00:00Z")),
        },
      ],
      exports: [appConfig.KEY, sentryConfig.KEY, ClockPort],
    };
  }
}

function appIn(environment: "development" | "staging" | "production") {
  return {
    nodeEnv: environment === "development" ? "development" : "production",
    environment,
    isProduction: environment === "production",
    isDevelopment: environment === "development",
  } as const;
}

async function resolveAdapters(settings: ObservabilitySettings) {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigStubModule.with(settings), AlertingModule],
  }).compile();
  return {
    alert: moduleRef.get(OperationalAlertPort),
    exceptions: moduleRef.get(ExceptionReporterPort),
    heartbeat: moduleRef.get(JobHeartbeatPort),
  };
}

const TestAlerts = defineAlerts("test", {
  SAMPLE: { key: "test.sample", severity: "error", summary: "예시", runbook: "확인한다" },
});

describe("AlertingModule — 환경별 관측 어댑터 선택", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it("운영에 DSN이 있으면 Sentry 어댑터를 쓰고 경보는 중복 제거로 감싼다", async () => {
    // Given
    const adapters = await resolveAdapters({ app: appIn("production"), sentry: { dsn: DSN } });

    // When
    adapters.alert.raise(TestAlerts.SAMPLE);

    // Then
    expect(adapters.alert).toBeInstanceOf(DeduplicatingOperationalAlertAdapter);
    expect(sentry.withScope).toHaveBeenCalledTimes(1);
    expect(adapters.exceptions).toBeInstanceOf(SentryExceptionReporter);
    expect(adapters.heartbeat).toBeInstanceOf(SentryJobHeartbeatAdapter);
  });

  it.each([
    { name: "개발", config: { app: appIn("development"), sentry: { dsn: DSN } } },
    { name: "스테이징", config: { app: appIn("staging"), sentry: { dsn: DSN } } },
    { name: "DSN 없는 운영", config: { app: appIn("production"), sentry: { dsn: undefined } } },
  ])(
    "$name 환경은 로그 어댑터와 no-op heartbeat를 쓰고 경보는 중복 제거로 감싼다",
    async ({ config }) => {
      // When
      const adapters = await resolveAdapters(config);

      // Then
      expect(adapters.alert).toBeInstanceOf(DeduplicatingOperationalAlertAdapter);
      expect(adapters.exceptions).toBeInstanceOf(LogExceptionReporterAdapter);
      expect(adapters.heartbeat).toBeInstanceOf(NoopJobHeartbeatAdapter);
    },
  );

  it("로그 어댑터와 no-op heartbeat는 경보·예외·check-in을 Sentry로 보내지 않는다", async () => {
    // Given
    const adapters = await resolveAdapters({ app: appIn("development"), sentry: { dsn: DSN } });
    const schedule = {
      cron: "*/10 * * * *",
      timezone: "UTC",
      graceMinutes: 5,
      maxRuntimeMinutes: 10,
      failuresBeforeAlert: 2,
    };

    // When
    adapters.alert.raise({ ...TestAlerts.SAMPLE, cause: new Error("boom") });
    adapters.exceptions.report(new Error("boom"), { userId: null, tags: {} });
    const result = await adapters.heartbeat.monitor(schedule, async () => "done");

    // Then
    expect(result).toBe("done");
    expect(sentry.withScope).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.withMonitor).not.toHaveBeenCalled();
  });
});
