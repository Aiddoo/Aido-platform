import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";

import { buildDailySummaryMessage } from "../../messages/notifications/admin-message.factory.js";
import { OperationsNotificationsLogEvent } from "../../observability/notifications/operations-notifications-log.events.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import { type SignupStatsReaderPort } from "../../ports/notifications/signup-stats.reader.port.js";
import { computePreviousKstDayRange } from "../../services/notifications/signup-report-period.js";

/**
 * 일일 가입 요약 발송 유스케이스.
 *
 * 전일(KST) 가입 통계를 집계해 관리자 채널 SEND 잡으로 큐에 등록한다.
 * 스케줄러 트리거(DISPATCH_SUMMARY)로 호출되며, 실패해도 예외를 전파하지 않는다.
 */
interface DispatchDailySignupSummaryDependencies {
  readonly reader: Pick<SignupStatsReaderPort, "getSignupStats">;
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly logger: Pick<ApplicationLogger, "log" | "error">;
}

export class DispatchDailySignupSummary {
  readonly #dependencies: DispatchDailySignupSummaryDependencies;

  constructor(dependencies: DispatchDailySignupSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    this.#dependencies.logger.log({ event: OperationsNotificationsLogEvent.SUMMARY_STARTED });

    try {
      const { startUtc, endUtc, reportDateStr } = computePreviousKstDayRange(now());

      const { signupsByProvider, totalUsers } = await this.#dependencies.reader.getSignupStats(
        startUtc,
        endUtc,
      );

      const message = buildDailySummaryMessage({
        signupsByProvider,
        totalUsers,
        reportDateStr,
      });

      await this.#dependencies.queue.enqueueSend("admin", message, {
        jobId: `signup-summary_${reportDateStr}`,
      });

      const previousDayTotal = signupsByProvider.reduce((sum, group) => sum + group.count, 0);
      this.#dependencies.logger.log({
        event: OperationsNotificationsLogEvent.SUMMARY_ENQUEUED,
        previousDayTotal,
        totalUsers,
      });
    } catch {
      this.#dependencies.logger.error({
        event: OperationsNotificationsLogEvent.SUMMARY_FAILED,
        errorType: "summary-dispatch",
      });
    }
  }
}
