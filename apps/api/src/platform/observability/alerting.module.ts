import { Global, Module } from "@nestjs/common";

import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";

import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

@Global()
@Module({
  providers: [{ provide: OPERATIONAL_ALERT, useClass: SentryOperationalAlertAdapter }],
  exports: [OPERATIONAL_ALERT],
})
export class AlertingModule {}
