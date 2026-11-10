import { sumBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { computePreviousKstDayRange } from "../../domain/signup-report-period.domain-service.js";
import { AdminNoticeLogEvent } from "../admin-notices.log-events.js";
import { buildDailySummaryMessage } from "../messages/admin-message.messages.js";
import type { AdminNotificationQueuePort } from "../ports/admin-notification-queue.port.js";
import type { SignupStatsReaderPort } from "../ports/signup-stats.reader.port.js";

export interface DispatchDailySignupSummaryDependencies {
  readonly statsReader: Pick<SignupStatsReaderPort, "getSignupStats">;
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

/**
 * 전일(KST) 가입 통계를 집계해 관리자 채널 SEND 작업으로 등록한다. 스케줄 작업이 불러서
 * 실패해도 예외를 전파하지 않는다(요약이 한 번 빠질 뿐 다음 날 다시 돈다).
 */
export class DispatchDailySignupSummaryUseCase {
  readonly #dependencies: DispatchDailySignupSummaryDependencies;

  constructor(dependencies: DispatchDailySignupSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const { statsReader, queue, clock, logger } = this.#dependencies;
    logger.log({ event: AdminNoticeLogEvent.SUMMARY_STARTED });

    try {
      const { start, end, reportDate } = computePreviousKstDayRange(clock.now());
      const { signupsByProvider, totalUsers } = await statsReader.getSignupStats(start, end);
      const reportDateStr = reportDate.toString();

      const message = buildDailySummaryMessage({ signupsByProvider, totalUsers, reportDateStr });
      await queue.enqueueSend(
        "admin",
        { type: "message", message },
        { jobId: `signup-summary_${reportDateStr}` },
      );

      logger.log({
        event: AdminNoticeLogEvent.SUMMARY_ENQUEUED,
        previousDayTotal: sumBy(signupsByProvider, (group) => group.count),
        totalUsers,
      });
    } catch {
      logger.error({ event: AdminNoticeLogEvent.SUMMARY_FAILED, errorType: "summary-dispatch" });
    }
  }
}
