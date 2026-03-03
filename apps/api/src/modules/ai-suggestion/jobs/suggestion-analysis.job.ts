import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { forEachBatch } from "@/common/database";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { AiSuggestionService } from "../ai-suggestion.service";

/** 잠금 TTL: 크론 간격보다 약간 짧게 설정 */
const LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간

/** Gemini API rate limit 고려하여 동시 처리 수 제한 */
const BATCH_SIZE = 5;

/**
 * AI 반복 제안 분석 크론 작업
 *
 * 매주 토요일 UTC 13:00 (KST 일요일 22:00)에 실행됩니다.
 * 최근 할 일이 있는 사용자들의 패턴을 분석하여 반복 제안을 생성합니다.
 *
 * 분산 락으로 중복 실행을 방지합니다.
 */
@Injectable()
export class SuggestionAnalysisJob {
	readonly #logger = new Logger(SuggestionAnalysisJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly aiSuggestionService: AiSuggestionService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 주간 패턴 분석 — 매주 토요일 UTC 13:00 (KST 일요일 22:00)
	 */
	@Cron("0 13 * * 6")
	async handleWeeklyAnalysis(): Promise<void> {
		this.#logger.log("Starting weekly suggestion analysis job...");

		const release = await this.lockProvider.acquire(
			"suggestion-analysis",
			LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping suggestion analysis — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#analyzeUsers();
		} catch (error) {
			this.#logger.error(
				`Suggestion analysis job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 최근 할 일이 있는 사용자들의 패턴 분석 수행
	 */
	async #analyzeUsers(): Promise<void> {
		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

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
						todos: {
							some: {
								startDate: { gte: fourWeeksAgo },
								recurrenceGroupId: null,
							},
						},
					},
					select: {
						id: true,
						preference: { select: { timezone: true } },
					},
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				const results = await Promise.allSettled(
					batch.map((user) => this.#processUserAnalysis(user)),
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
							`Suggestion analysis failed: ${result.reason}`,
							result.reason instanceof Error ? result.reason.stack : undefined,
						);
					}
				}
			},
		});

		this.#logger.log(
			`Suggestion analysis completed: success=${successCount}, skipped=${skipCount}, errors=${errorCount}`,
		);
	}

	/**
	 * 개별 사용자 패턴 분석 및 알림 발송
	 */
	async #processUserAnalysis(user: {
		id: string;
		preference: { timezone: string } | null;
	}): Promise<"success" | "skipped"> {
		const timezone = user.preference?.timezone ?? "Asia/Seoul";
		const createdCount =
			await this.aiSuggestionService.analyzeAndCreateSuggestions(
				user.id,
				timezone,
			);

		if (createdCount === 0) {
			return "skipped";
		}

		// 새 제안 생성 알림 발송
		const message = NotificationMessageBuilder.aiSuggestion();
		await this.notificationService.createAndSend({
			userId: user.id,
			type: "AI_SUGGESTION",
			title: message.title,
			body: message.body,
		});

		return "success";
	}
}
