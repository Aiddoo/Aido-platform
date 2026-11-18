import { Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { appConfig } from "#api/platform/config/app.config";
import { sentryConfig } from "#api/platform/config/sentry.config";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { DeduplicatingOperationalAlertAdapter } from "./deduplicating-operational-alert.adapter.js";
import { LogExceptionReporterAdapter } from "./log-exception-reporter.adapter.js";
import { LogOperationalAlertAdapter } from "./log-operational-alert.adapter.js";
import { NoopJobHeartbeatAdapter } from "./noop-job-heartbeat.adapter.js";
import { type ObservabilityBackend, selectObservabilityBackend } from "./observability-backend.js";
import { RequestScopeInterceptor } from "./request-scope.interceptor.js";
import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";
import { SentryJobHeartbeatAdapter } from "./sentry-job-heartbeat.adapter.js";
import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

/**
 * 환경별 어댑터 표. 관측 포트를 더하면 이 표에 열 하나를 더하고 같은 판정으로 고른다.
 * 경보 중복 제거는 고른 어댑터 바깥에 두어 모든 환경에서 같게 돈다.
 */
const OBSERVABILITY_ADAPTERS = {
  sentry: {
    alert: SentryOperationalAlertAdapter,
    exceptions: SentryExceptionReporter,
    heartbeat: SentryJobHeartbeatAdapter,
  },
  log: {
    alert: LogOperationalAlertAdapter,
    exceptions: LogExceptionReporterAdapter,
    heartbeat: NoopJobHeartbeatAdapter,
  },
} satisfies Record<
  ObservabilityBackend,
  {
    readonly alert: new () => OperationalAlertPort;
    readonly exceptions: new () => ExceptionReporterPort;
    readonly heartbeat: new () => JobHeartbeatPort;
  }
>;

type AppSettings = ConfigType<typeof appConfig>;
type SentrySettings = ConfigType<typeof sentryConfig>;

function adaptersFor(app: AppSettings, sentry: SentrySettings) {
  return OBSERVABILITY_ADAPTERS[selectObservabilityBackend({ app, sentry })];
}

@Global()
@Module({
  providers: [
    {
      provide: OperationalAlertPort,
      inject: [appConfig.KEY, sentryConfig.KEY, ClockPort],
      useFactory: (
        app: AppSettings,
        sentry: SentrySettings,
        clock: ClockPort,
      ): OperationalAlertPort =>
        new DeduplicatingOperationalAlertAdapter(new (adaptersFor(app, sentry).alert)(), clock),
    },
    {
      provide: ExceptionReporterPort,
      inject: [appConfig.KEY, sentryConfig.KEY],
      useFactory: (app: AppSettings, sentry: SentrySettings): ExceptionReporterPort =>
        new (adaptersFor(app, sentry).exceptions)(),
    },
    {
      provide: JobHeartbeatPort,
      inject: [appConfig.KEY, sentryConfig.KEY],
      useFactory: (app: AppSettings, sentry: SentrySettings): JobHeartbeatPort =>
        new (adaptersFor(app, sentry).heartbeat)(),
    },
    { provide: APP_INTERCEPTOR, useClass: RequestScopeInterceptor },
  ],
  exports: [OperationalAlertPort, ExceptionReporterPort, JobHeartbeatPort],
})
export class AlertingModule {}
