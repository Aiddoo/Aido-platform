import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import {
  alertIssueKey,
  type OperationalAlert,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";
import { SENTRY_EXTRA, SENTRY_TAG } from "./sentry-keys.js";

/**
 * 운영 경보를 Sentry 이슈로 남긴다. fingerprint를 경보 key로 고정해 같은 상황은 한 이슈로 모이고,
 * 카탈로그 정보는 고정 태그(alert_key·alert_context·severity)라 Sentry 알림 규칙이 태그로 거른다.
 */
@Injectable()
export class SentryOperationalAlertAdapter implements OperationalAlertPort {
  readonly #logger = new Logger(SentryOperationalAlertAdapter.name);

  raise(alert: OperationalAlert): void {
    try {
      Sentry.withScope((scope) => {
        scope.setFingerprint([alertIssueKey(alert)]);
        scope.setTags(alert.tags ?? {});
        // 호출부 태그가 고정 태그를 덮지 못하게 뒤에 쓴다
        scope.setTags({
          [SENTRY_TAG.ALERT_KEY]: alert.key,
          [SENTRY_TAG.ALERT_CONTEXT]: alert.context,
          [SENTRY_TAG.SEVERITY]: alert.severity,
          ...(alert.subject != null && { [SENTRY_TAG.ALERT_SUBJECT]: alert.subject }),
        });
        scope.setExtras({ ...alert.details, [SENTRY_EXTRA.RUNBOOK]: alert.runbook });
        scope.setLevel(alert.severity);
        if (alert.cause == null) {
          Sentry.captureMessage(alert.summary, alert.severity);
          return;
        }
        scope.setExtra("alertSummary", alert.summary);
        Sentry.captureException(alert.cause);
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
