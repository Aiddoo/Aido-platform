import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import dayjs from "dayjs";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { AI_PER_USER_JOB_OPTS } from "@/shared/infrastructure/bullmq/job-options";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { forEachBatch } from "@/shared/infrastructure/database/utils/batch-cursor.util";
import { SuggestionAnalysisProcessor } from "../processors/suggestion-analysis.processor";
import {
	AI_SUGGESTION_QUEUE,
	type AiSuggestionAnalyzeData,
	type AiSuggestionJobData,
	AiSuggestionJobName,
} from "../queue/ai-suggestion-queue";
import { AiSuggestionQueueMaintenanceService } from "../queue/ai-suggestion-queue-maintenance.service";
import { AI_SUGGESTION_FAILED_JOB_RETENTION } from "../queue/ai-suggestion-retention.policy";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/**
 * AI 반복 제안 분석 스케줄러 (Dispatcher)
 *
 * 매일 KST 07:30에 실행됩니다.
 * BullMQ Job Scheduler를 사용하여 Redis에 스케줄을 저장합니다.
 * 서버 재시작 시에도 스케줄이 유지되며, 놓친 잡은 자동으로 실행됩니다.
 */
@Injectable()
export class SuggestionAnalysisJob implements OnModuleInit {
	readonly #logger = new Logger(SuggestionAnalysisJob.name);

	constructor(
		private readonly database: DatabaseService,
		@InjectQueue(AI_SUGGESTION_QUEUE)
		private readonly queue: Queue<AiSuggestionJobData>,
		private readonly processor: SuggestionAnalysisProcessor,
		private readonly queueMaintenance: AiSuggestionQueueMaintenanceService,
	) {}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setSuggestionJob(this);

		// Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Suggestion analysis scheduler registration",
			async () => {
				// 구 weekly 스케줄러 제거 (마이그레이션)
				await this.queue.removeJobScheduler("weekly-suggestion-scheduler");

				await this.queue.upsertJobScheduler(
					"daily-suggestion-scheduler",
					{ pattern: "30 7 * * *", tz: "Asia/Seoul" },
					{
						name: AiSuggestionJobName.DISPATCH,
						data: {},
						opts: { removeOnFail: AI_SUGGESTION_FAILED_JOB_RETENTION },
					},
				);

				this.#logger.log("Suggestion analysis scheduler registered");

				await this.#catchUpIfNeeded();
			},
		);
	}

	/**
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async dispatchAnalysis(dispatchJob?: Job): Promise<void> {
		this.#logger.log("Starting suggestion analysis dispatch...");
		await this.queueMaintenance.cleanExpiredFailures();

		const twoWeeksAgo = subtractDays(14);

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
								startDate: { gte: twoWeeksAgo },
								recurrenceGroupId: null,
							},
						},
					},
					select: {
						id: true,
						preference: { select: { timezone: true } },
						location: {
							select: {
								gridX: true,
								gridY: true,
								latitude: true,
								longitude: true,
							},
						},
					},
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				const jobs = batch.map((user) => ({
					name: AiSuggestionJobName.ANALYZE,
					data: {
						userId: user.id,
						timezone: user.preference?.timezone ?? "Asia/Seoul",
						weatherGrid: user.location
							? {
									gridX: user.location.gridX,
									gridY: user.location.gridY,
									lat: user.location.latitude,
									lon: user.location.longitude,
								}
							: null,
					} satisfies AiSuggestionAnalyzeData,
					opts: {
						...AI_PER_USER_JOB_OPTS,
						removeOnFail: AI_SUGGESTION_FAILED_JOB_RETENTION,
						jobId: `suggestion_${user.id}_${periodId}`,
					},
				}));

				await this.queue.addBulk(jobs);
				totalEnqueued += jobs.length;
				await dispatchJob?.updateProgress({ enqueued: totalEnqueued });
			},
		});

		this.#logger.log(
			`Suggestion analysis jobs enqueued: total=${totalEnqueued}`,
		);
	}

	/**
	 * 서버 재시작 시 놓친 크론 스케줄을 보정합니다.
	 */
	async #catchUpIfNeeded(): Promise<void> {
		const kstNow = dayjs().tz("Asia/Seoul");
		const hour = kstNow.hour();

		// 매일 07:30 이후
		if (hour > 7 || (hour === 7 && kstNow.minute() >= 30)) {
			this.#logger.log("Catch-up: suggestion analysis dispatch");
			await this.queue.add(
				AiSuggestionJobName.DISPATCH,
				{},
				{
					jobId: `dispatch_suggestion_${kstNow.format("YYYY-MM-DD")}`,
					removeOnFail: AI_SUGGESTION_FAILED_JOB_RETENTION,
				},
			);
		}
	}

	/**
	 * jobId 중복 방지용 날짜 식별자 생성
	 */
	#getJobDeduplicationId(): string {
		return dayjs().tz("Asia/Seoul").format("YYYY-MM-DD");
	}
}
