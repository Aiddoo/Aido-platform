import { Global, Module } from "@nestjs/common";

import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";

import { SentryOperationalAlertAdapter } from "./sentry-operational-alert.adapter.js";

/** 운영 경보 포트 하나를 전역으로 제공한다. */
@Global()
@Module({
  providers: [{ provide: OPERATIONAL_ALERT, useClass: SentryOperationalAlertAdapter }],
  exports: [OPERATIONAL_ALERT],
})
export class AlertingModule {}
