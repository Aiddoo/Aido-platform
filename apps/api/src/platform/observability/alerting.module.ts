import { Global, Module } from "@nestjs/common";

import { ExceptionReporterPort } from "#api/shared/application/ports/exception-reporter.port";
import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { SentryExceptionReporter } from "./sentry-exception-reporter.adapter.js";
import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

@Global()
@Module({
  providers: [
    { provide: OPERATIONAL_ALERT, useClass: SentryOperationalAlertAdapter },
    { provide: OperationalAlertPort, useExisting: OPERATIONAL_ALERT },
    { provide: ExceptionReporterPort, useClass: SentryExceptionReporter },
  ],
  exports: [OPERATIONAL_ALERT, OperationalAlertPort, ExceptionReporterPort],
})
export class AlertingModule {}
