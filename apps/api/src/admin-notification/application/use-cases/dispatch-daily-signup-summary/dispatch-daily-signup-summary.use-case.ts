import { Inject, Injectable, Logger } from "@nestjs/common";

import { now } from "@/shared/domain/date/utils/core";

import { buildDailySummaryMessage } from "../../../domain/services/admin-message.factory";
import { computePreviousKstDayRange } from "../../../domain/services/signup-report-period";
import {
	ADMIN_NOTIFICATION_QUEUE_PORT,
	type AdminNotificationQueuePort,
} from "../../ports/admin-notification-queue.port";
import {
	SIGNUP_STATS_READER,
	type SignupStatsReaderPort,
} from "../../ports/signup-stats.reader.port";

/**
 * 일일 가입 요약 발송 유스케이스.
 *
 * 전일(KST) 가입 통계를 집계해 관리자 채널 SEND 잡으로 큐에 등록한다.
 * 스케줄러 트리거(DISPATCH_SUMMARY)로 호출되며, 실패해도 예외를 전파하지 않는다.
 */
@Injectable()
export class DispatchDailySignupSummaryUseCase {
	readonly #logger = new Logger(DispatchDailySignupSummaryUseCase.name);

	constructor(
		@Inject(SIGNUP_STATS_READER)
		private readonly reader: SignupStatsReaderPort,
		@Inject(ADMIN_NOTIFICATION_QUEUE_PORT)
		private readonly queue: AdminNotificationQueuePort,
	) {}

	async execute(): Promise<void> {
		this.#logger.log("Starting daily signup summary job...");

		try {
			const { startUtc, endUtc, reportDateStr } = computePreviousKstDayRange(
				now(),
			);

			const { signupsByProvider, totalUsers } =
				await this.reader.getSignupStats(startUtc, endUtc);

			const message = buildDailySummaryMessage({
				signupsByProvider,
				totalUsers,
				reportDateStr,
			});

			await this.queue.enqueueSend("admin", message.toPayload(), {
				jobId: `signup-summary_${reportDateStr}`,
			});

			const previousDayTotal = signupsByProvider.reduce(
				(sum, group) => sum + group.count,
				0,
			);
			this.#logger.log(
				`Daily signup summary job enqueued: ${previousDayTotal} new, ${totalUsers} total`,
			);
		} catch (error) {
			this.#logger.error(
				`Daily signup summary job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
