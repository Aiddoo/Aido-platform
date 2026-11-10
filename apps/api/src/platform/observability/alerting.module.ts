import { Global, Module } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { DeduplicatingOperationalAlertAdapter } from "./deduplicating-operational-alert.adapter.js";
import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";
import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

@Global()
@Module({
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
  ],
  exports: [OPERATIONAL_ALERT, OperationalAlertPort, ExceptionReporterPort],
})
export class AlertingModule {}
