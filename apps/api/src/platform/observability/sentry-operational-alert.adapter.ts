import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import {
  alertIssueKey,
  type OperationalAlert,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { isBusinessRejection } from "#api/shared/application/utils/business-rejection";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

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
        // 이슈 부제는 transaction이다. 비우면 경보를 올린 요청·작업 이름이 보여 경보 key로 둔다
        scope.setTransactionName(alert.key);
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
        // 업무 거부가 원인이면 스택은 쓸모없고 예외 이름이 이슈 제목이 되어 4xx가 오류로 보이므로 경보 문장으로 보낸다
        if (alert.cause == null || isBusinessRejection(alert.cause)) {
          if (alert.cause instanceof ErrorCodedException) {
            scope.setExtra("errorCode", alert.cause.errorCode);
          }
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
