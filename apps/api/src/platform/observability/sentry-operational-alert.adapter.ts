import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform-log.events.js";
import { SENTRY_TAG } from "./sentry-keys.js";

/**
 * 운영 경보를 Sentry 이슈로 남긴다. fingerprint를 경보 key로 고정해 같은 상황은 한 이슈로 모이고,
 * Discord·Slack 전달은 Sentry 알림 규칙이 맡는다.
 */
@Injectable()
export class SentryOperationalAlertAdapter implements OperationalAlertPort {
  readonly #logger = new Logger(SentryOperationalAlertAdapter.name);

  raise(alert: OperationalAlert): void {
    try {
      Sentry.withScope((scope) => {
        scope.setFingerprint([alert.key]);
        scope.setTag(SENTRY_TAG.ALERT_KEY, alert.key);
        scope.setTags(alert.tags ?? {});
        scope.setExtras(alert.details ?? {});
        Sentry.captureMessage(alert.message, alert.severity);
      });
    } catch (error) {
      this.#logger.warn({
        event: PlatformLogEvent.OPERATIONAL_ALERT_FAILED,
        alertKey: alert.key,
        errorType: toErrorType(error),
      });
    }
  }
}
