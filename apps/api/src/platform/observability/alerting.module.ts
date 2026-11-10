import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";
import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { DeduplicatingOperationalAlertAdapter } from "./deduplicating-operational-alert.adapter.js";
import { jobHeartbeatConfig } from "./job-heartbeat.config.js";
import { jobHeartbeatProvider } from "./job-heartbeat.providers.js";
import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";
import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

@Global()
@Module({
  imports: [ConfigModule.forFeature(jobHeartbeatConfig)],
  providers: [
    SentryOperationalAlertAdapter,
    {
      provide: OPERATIONAL_ALERT,
      inject: [SentryOperationalAlertAdapter, ClockPort],
      useFactory: (sentry: SentryOperationalAlertAdapter, clock: ClockPort) =>
        new DeduplicatingOperationalAlertAdapter(sentry, clock),
    },
    { provide: OperationalAlertPort, useExisting: OPERATIONAL_ALERT },
    { provide: ExceptionReporterPort, useClass: SentryExceptionReporter },
    jobHeartbeatProvider,
  ],
  exports: [OPERATIONAL_ALERT, OperationalAlertPort, ExceptionReporterPort, JobHeartbeatPort],
})
export class AlertingModule {}
