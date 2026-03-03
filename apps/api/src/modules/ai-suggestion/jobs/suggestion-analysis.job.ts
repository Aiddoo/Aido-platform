import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "../../notification/notification.service";
import { AiSuggestionService } from "../ai-suggestion.service";

/** 잠금 TTL: 크론 간격보다 약간 짧게 설정 */
const LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간

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
		// 최근 4주간 할 일이 있는 사용자 조회
		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

		const users = await this.database.todo.findMany({
			where: {
				startDate: { gte: fourWeeksAgo },
				recurrenceGroupId: null,
			},
			select: { userId: true },
			distinct: ["userId"],
		});

		this.#logger.log(
			`Suggestion analysis: found ${users.length} users with recent todos`,
		);

		let successCount = 0;
		let skipCount = 0;
		let errorCount = 0;

		for (const { userId } of users) {
			try {
				const createdCount =
					await this.aiSuggestionService.analyzeAndCreateSuggestions(userId);

				if (createdCount === 0) {
					skipCount++;
					continue;
				}

				// 새 제안 생성 알림 발송
				await this.notificationService.createAndSend({
					userId,
					type: "AI_SUGGESTION",
					title: "새로운 반복 제안이 도착했다냥",
					body: "패턴을 분석해봤어! 확인해볼래?",
				});

				successCount++;
			} catch (error) {
				// 개별 사용자 에러는 격리하여 다른 사용자에게 영향을 주지 않음
				errorCount++;
				this.#logger.error(
					`Suggestion analysis failed for userId=${userId}: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}

		this.#logger.log(
			`Suggestion analysis completed: success=${successCount}, skipped=${skipCount}, errors=${errorCount}`,
		);
	}
}
