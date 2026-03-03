import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { forEachBatch } from "@/common/database";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import type { NotificationType } from "@/generated/prisma/client";
import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { AiReportService } from "../ai-report.service";

/** 잠금 TTL: 크론 간격보다 약간 짧게 설정 */
const WEEKLY_LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간
const MONTHLY_LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간

/** Gemini API rate limit 고려하여 동시 처리 수 제한 */
const BATCH_SIZE = 5;

/**
 * AI 리포트 생성 크론 작업
 *
 * - 주간 리포트: 매주 일요일 UTC 22:00 (KST 월요일 07:00)
 * - 월간 리포트: 매월 마지막 날 UTC 22:00 (KST 1일 07:00)
 *
 * 분산 락으로 중복 실행을 방지합니다.
 */
@Injectable()
export class ReportGenerationJob {
	readonly #logger = new Logger(ReportGenerationJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly aiReportService: AiReportService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 주간 리포트 생성 — 매주 일요일 UTC 22:00
	 */
	@Cron("0 22 * * 0")
	async handleWeeklyReport(): Promise<void> {
		this.#logger.log("Starting weekly report generation job...");

		const release = await this.lockProvider.acquire(
			"report-weekly",
			WEEKLY_LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping weekly report — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#generateReportsForUsers("WEEKLY");
		} catch (error) {
			this.#logger.error(
				`Weekly report generation job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 월간 리포트 생성 — 매월 1일 UTC 22:00 (KST 2일 07:00)
	 *
	 * 전월 데이터를 기반으로 리포트를 생성합니다.
	 */
	@Cron("0 22 1 * *")
	async handleMonthlyReport(): Promise<void> {
		this.#logger.log("Starting monthly report generation job...");

		const release = await this.lockProvider.acquire(
			"report-monthly",
			MONTHLY_LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping monthly report — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#generateReportsForUsers("MONTHLY");
		} catch (error) {
			this.#logger.error(
				`Monthly report generation job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 푸시 알림이 활성화된 사용자들에 대해 리포트 생성
	 */
	async #generateReportsForUsers(type: "WEEKLY" | "MONTHLY"): Promise<void> {
		let successCount = 0;
		let skipCount = 0;
		let errorCount = 0;

		await forEachBatch({
			batchSize: BATCH_SIZE,
			fetchPage: (cursor, take) =>
				this.database.user.findMany({
					where: {
						...(cursor && { id: { gt: cursor } }),
						OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
					},
					select: {
						id: true,
						preference: {
							select: { timezone: true },
						},
					},
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				const results = await Promise.allSettled(
					batch.map((user) => this.#processUserReport(user, type)),
				);

				for (const result of results) {
					if (result.status === "fulfilled") {
						if (result.value === "skipped") {
							skipCount++;
						} else {
							successCount++;
						}
					} else {
						errorCount++;
						this.#logger.error(
							`${type} report failed: ${result.reason}`,
							result.reason instanceof Error ? result.reason.stack : undefined,
						);
					}
				}
			},
		});

		this.#logger.log(
			`${type} report completed: success=${successCount}, skipped=${skipCount}, errors=${errorCount}`,
		);
	}

	/**
	 * 개별 사용자 리포트 생성 및 알림 발송
	 */
	async #processUserReport(
		user: { id: string; preference: { timezone: string } | null },
		type: "WEEKLY" | "MONTHLY",
	): Promise<"success" | "skipped"> {
		const timezone = user.preference?.timezone ?? "Asia/Seoul";

		const report =
			type === "WEEKLY"
				? await this.aiReportService.generateWeeklyReport(user.id, timezone)
				: await this.aiReportService.generateMonthlyReport(user.id, timezone);

		if (!report) {
			return "skipped";
		}

		// 리포트 생성 알림 발송
		const notificationType: NotificationType =
			type === "WEEKLY" ? "WEEKLY_REPORT" : "MONTHLY_REPORT";

		const message =
			type === "WEEKLY"
				? NotificationMessageBuilder.weeklyReport()
				: NotificationMessageBuilder.monthlyReport();

		await this.notificationService.createAndSend({
			userId: user.id,
			type: notificationType,
			title: message.title,
			body: message.body,
		});

		return "success";
	}
}
