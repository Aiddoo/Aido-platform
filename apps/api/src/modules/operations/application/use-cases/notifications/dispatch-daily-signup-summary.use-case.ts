import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";

import { buildDailySummaryMessage } from "../../../domain/services/notifications/admin-message.factory.js";
import { computePreviousKstDayRange } from "../../../domain/services/notifications/signup-report-period.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import { type SignupStatsReaderPort } from "../../ports/notifications/signup-stats.reader.port.js";

/**
 * 일일 가입 요약 발송 유스케이스.
 *
 * 전일(KST) 가입 통계를 집계해 관리자 채널 SEND 잡으로 큐에 등록한다.
 * 스케줄러 트리거(DISPATCH_SUMMARY)로 호출되며, 실패해도 예외를 전파하지 않는다.
 */
interface DispatchDailySignupSummaryDependencies {
  readonly reader: SignupStatsReaderPort;
  readonly queue: AdminNotificationQueuePort;
  readonly logger: ApplicationLogger;
}

export class DispatchDailySignupSummary {
  readonly #dependencies: DispatchDailySignupSummaryDependencies;

  constructor(dependencies: DispatchDailySignupSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    this.#dependencies.logger.log("Starting daily signup summary job...");

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

      await this.#dependencies.queue.enqueueSend("admin", message.toPayload(), {
        jobId: `signup-summary_${reportDateStr}`,
      });

      const previousDayTotal = signupsByProvider.reduce((sum, group) => sum + group.count, 0);
      this.#dependencies.logger.log(
        `Daily signup summary job enqueued: ${previousDayTotal} new, ${totalUsers} total`,
      );
    } catch (error) {
      this.#dependencies.logger.error(
        `Daily signup summary job failed: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
