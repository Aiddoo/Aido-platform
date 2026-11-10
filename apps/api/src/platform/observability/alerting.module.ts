import { Global, Module } from "@nestjs/common";

import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

@Global()
@Module({
  providers: [
    { provide: OPERATIONAL_ALERT, useClass: SentryOperationalAlertAdapter },
    { provide: OperationalAlertPort, useExisting: OPERATIONAL_ALERT },
  ],
  exports: [OPERATIONAL_ALERT, OperationalAlertPort],
})
export class AlertingModule {}
