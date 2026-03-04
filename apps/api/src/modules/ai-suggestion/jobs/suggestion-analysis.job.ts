import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { AI_PER_USER_JOB_OPTS } from "@/common/bullmq/job-options";
import { forEachBatch } from "@/common/database";
import { subtractDays } from "@/common/date/utils/arithmetic";
import { toIsoWeekId } from "@/common/date/utils/format";
import { DatabaseService } from "@/database/database.service";
import {
	AI_SUGGESTION_QUEUE,
	type AiSuggestionAnalyzeData,
	type AiSuggestionJobData,
	AiSuggestionJobName,
	SuggestionAnalysisProcessor,
} from "../processors/suggestion-analysis.processor";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/**
 * AI 반복 제안 분석 스케줄러 (Dispatcher)
 *
 * 매주 일요일 UTC 11:00 (KST 일요일 20:00)에 실행됩니다.
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
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setSuggestionJob(this);

		await this.queue.upsertJobScheduler(
			"weekly-suggestion-scheduler",
			{ pattern: "0 11 * * 0" },
			{ name: AiSuggestionJobName.DISPATCH, data: {} },
		);

		this.#logger.log("Suggestion analysis scheduler registered");
	}

	/**
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async dispatchAnalysis(dispatchJob?: Job): Promise<void> {
		this.#logger.log("Starting suggestion analysis dispatch...");

		const fourWeeksAgo = subtractDays(28);

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
					name: AiSuggestionJobName.ANALYZE,
					data: {
						userId: user.id,
						timezone: user.preference?.timezone ?? "Asia/Seoul",
					} satisfies AiSuggestionAnalyzeData,
					opts: {
						...AI_PER_USER_JOB_OPTS,
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
	 * jobId 중복 방지용 ISO 주번호 식별자 생성
	 */
	#getJobDeduplicationId(): string {
		return toIsoWeekId();
	}
}
