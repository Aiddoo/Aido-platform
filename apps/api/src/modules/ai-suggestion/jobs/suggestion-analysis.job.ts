import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import { forEachBatch } from "@/common/database";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import {
	AI_SUGGESTION_QUEUE,
	type AiSuggestionJobData,
} from "../processors/suggestion-analysis.processor";

/** 잠금 TTL: 크론 간격보다 약간 짧게 설정 */
const LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/**
 * AI 반복 제안 분석 크론 작업 (Dispatcher)
 *
 * 매주 토요일 UTC 13:00 (KST 일요일 22:00)에 실행됩니다.
 * 최근 할 일이 있는 사용자들을 조회하여 BullMQ 큐에 per-user 잡을 등록합니다.
 * 실제 처리는 SuggestionAnalysisProcessor가 담당합니다.
 *
 * 분산 락으로 중복 등록을 방지합니다.
 */
@Injectable()
export class SuggestionAnalysisJob implements OnModuleInit {
	readonly #logger = new Logger(SuggestionAnalysisJob.name);

	constructor(
		private readonly database: DatabaseService,
		@InjectQueue(AI_SUGGESTION_QUEUE)
		private readonly queue: Queue<AiSuggestionJobData>,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 서버 시작 시 놓친 제안 분석 catch-up
	 *
	 * Redis 분산 락(23h TTL)이 존재하면 최근 크론이 성공한 것이므로 스킵.
	 * 락이 만료되었으면 서버 다운 중 크론을 놓친 것이므로 즉시 실행.
	 */
	async onModuleInit(): Promise<void> {
		try {
			this.#logger.log("Checking for missed suggestion analysis...");
			await this.handleWeeklyAnalysis();
		} catch (error) {
			this.#logger.error(
				`Suggestion analysis catch-up failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

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
			await this.#enqueueAnalysis();
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
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async #enqueueAnalysis(): Promise<void> {
		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

		const periodId = this.#getJobDeduplicationId();
		let totalEnqueued = 0;

		await forEachBatch({
			batchSize: ENQUEUE_BATCH_SIZE,
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
				const jobs = batch.map((user) => ({
					name: "analyze-suggestion",
					data: {
						userId: user.id,
						timezone: user.preference?.timezone ?? "Asia/Seoul",
					} satisfies AiSuggestionJobData,
					opts: {
						jobId: `suggestion:${user.id}:${periodId}`,
						attempts: 3,
						backoff: { type: "exponential" as const, delay: 5_000 },
						removeOnComplete: true,
						removeOnFail: 100,
					},
				}));

				await this.queue.addBulk(jobs);
				totalEnqueued += jobs.length;
			},
		});

		this.#logger.log(
			`Suggestion analysis jobs enqueued: total=${totalEnqueued}`,
		);
	}

	/**
	 * jobId 중복 방지용 식별자 생성
	 */
	#getJobDeduplicationId(): string {
		const now = new Date();
		const year = now.getFullYear();
		const jan1 = new Date(year, 0, 1);
		const days = Math.floor(
			(now.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000),
		);
		const weekNumber = Math.ceil((days + jan1.getDay() + 1) / 7);
		return `${year}-W${String(weekNumber).padStart(2, "0")}`;
	}
}
