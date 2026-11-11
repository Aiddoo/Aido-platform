import { Injectable, Logger } from "@nestjs/common";

import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";

/** Sentry로 보내지 않는 환경(개발·스테이징·테스트, DSN 없음)에서 경보를 콘솔 로그로 보이게 한다. */
@Injectable()
export class LogOperationalAlertAdapter implements OperationalAlertPort {
  readonly #logger = new Logger(LogOperationalAlertAdapter.name);

  raise(alert: OperationalAlert): void {
    const fields = {
      event: PlatformLogEvent.OPERATIONAL_ALERT_RAISED,
      alertKey: alert.key,
      alertContext: alert.context,
      ...(alert.subject != null && { alertSubject: alert.subject }),
      severity: alert.severity,
      summary: alert.summary,
      tags: alert.tags,
      details: alert.details,
      ...(alert.cause != null && { errorType: toErrorType(alert.cause) }),
    };
    const stack = alert.cause instanceof Error ? alert.cause.stack : undefined;
    if (alert.severity === "error") {
      this.#logger.error(fields, stack);
      return;
    }
    this.#logger.warn(fields, stack);
  }
}
