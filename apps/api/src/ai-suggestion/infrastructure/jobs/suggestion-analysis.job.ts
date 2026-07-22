import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";
import {
	JOB_RUNTIME,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { forEachBatch } from "@/shared/infrastructure/database/utils/batch-cursor.util";
import { SuggestionAnalysisProcessor } from "../processors/suggestion-analysis.processor";
import {
	AI_SUGGESTION_LEGACY_QUEUE,
	AI_SUGGESTION_QUEUE,
	type AiSuggestionAnalyzeData,
	AiSuggestionJobName,
} from "../queue/ai-suggestion-queue";
import { AiSuggestionQueueMaintenanceService } from "../queue/ai-suggestion-queue-maintenance.service";

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
		@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
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
				await this.runtime.unschedule(
					"weekly-suggestion-scheduler",
					AI_SUGGESTION_LEGACY_QUEUE,
				);
				await this.runtime.schedule(
					"daily-suggestion-scheduler",
					"30 7 * * *",
					AI_SUGGESTION_QUEUE,
					{ name: AiSuggestionJobName.DISPATCH, data: {} },
					this.#jobOptions(),
				);

				this.#logger.log("Suggestion analysis scheduler registered");

				await this.#catchUpIfNeeded();
			},
		);
	}

	/**
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async dispatchAnalysis(dispatchJob?: {
		updateProgress(progress: object): Promise<unknown>;
	}): Promise<void> {
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
				await Promise.all(
					batch.map((user) =>
						this.runtime.enqueue(
							AI_SUGGESTION_QUEUE,
							{
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
							},
							{
								...this.#jobOptions(),
								jobKey: `suggestion_${user.id}_${periodId}`,
							},
						),
					),
				);
				totalEnqueued += batch.length;
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
			await this.runtime.enqueue(
				AI_SUGGESTION_QUEUE,
				{ name: AiSuggestionJobName.DISPATCH, data: {} },
				{
					...this.#jobOptions(),
					jobKey: `dispatch_suggestion_${kstNow.format("YYYY-MM-DD")}`,
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

	#jobOptions() {
		return {
			retryLimit: 2,
			retryDelaySeconds: 5,
			retryBackoff: true,
			expireInSeconds: 10 * 60,
			retentionSeconds: 24 * 60 * 60,
			deleteAfterSeconds: 7 * 24 * 60 * 60,
			timezone: "Asia/Seoul",
		};
	}
}
