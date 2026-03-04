import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { NotificationType } from "@/generated/prisma/client";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { AiReportService } from "../ai-report.service";

// =============================================================================
// Constants & Types
// =============================================================================

export const AI_REPORT_QUEUE = "ai-report-generation";

export interface AiReportJobData {
	userId: string;
	timezone: string;
	reportType: "WEEKLY" | "MONTHLY";
}

// =============================================================================
// Processor
// =============================================================================

/**
 * AI 리포트 생성 BullMQ 프로세서
 *
 * - 단일 사용자 리포트 생성 + 알림 발송
 * - BullMQ 자동 재시도 (3회, exponential backoff)
 * - concurrency=5로 Gemini API rate limit 대응
 */
@Processor(AI_REPORT_QUEUE, { concurrency: 5 })
export class ReportGenerationProcessor extends WorkerHost {
	readonly #logger = new Logger(ReportGenerationProcessor.name);

	constructor(
		private readonly aiReportService: AiReportService,
		private readonly notificationService: NotificationService,
	) {
		super();
	}

	async process(job: Job<AiReportJobData>): Promise<void> {
		const { userId, timezone, reportType } = job.data;

		this.#logger.debug(`Processing ${reportType} report: userId=${userId}`);

		const report =
			reportType === "WEEKLY"
				? await this.aiReportService.generateWeeklyReport(userId, timezone)
				: await this.aiReportService.generateMonthlyReport(userId, timezone);

		if (!report) {
			this.#logger.debug(
				`Report skipped (insufficient data): userId=${userId}, type=${reportType}`,
			);
			return;
		}

		const notificationType: NotificationType =
			reportType === "WEEKLY" ? "WEEKLY_REPORT" : "MONTHLY_REPORT";

		const message =
			reportType === "WEEKLY"
				? NotificationMessageBuilder.weeklyReport()
				: NotificationMessageBuilder.monthlyReport();

		await this.notificationService.createAndSend({
			userId,
			type: notificationType,
			title: message.title,
			body: message.body,
		});

		this.#logger.log(`${reportType} report generated: userId=${userId}`);
	}
}
