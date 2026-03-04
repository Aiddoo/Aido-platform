import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { AiSuggestionService } from "../ai-suggestion.service";
import type { SuggestionAnalysisJob } from "../jobs/suggestion-analysis.job";

// =============================================================================
// Constants & Types
// =============================================================================

export const AI_SUGGESTION_QUEUE = "ai-suggestion-analysis";

/** 잡 이름 상수 */
export const AiSuggestionJobName = {
	DISPATCH: "dispatch-analysis",
	ANALYZE: "analyze-suggestion",
} as const;

/** per-user 제안 분석 잡 데이터 */
export interface AiSuggestionAnalyzeData {
	userId: string;
	timezone: string;
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AiSuggestionJobMap {
	[AiSuggestionJobName.DISPATCH]: Record<string, never>;
	[AiSuggestionJobName.ANALYZE]: AiSuggestionAnalyzeData;
}

export type AiSuggestionJobData = AiSuggestionJobMap[keyof AiSuggestionJobMap];

// =============================================================================
// Processor
// =============================================================================

/**
 * AI 반복 제안 분석 BullMQ 프로세서
 *
 * - dispatch-analysis: 스케줄러 트리거 → per-user 잡 등록
 * - analyze-suggestion: 단일 사용자 패턴 분석 + 알림 발송
 * - BullMQ 자동 재시도 (3회, exponential backoff)
 * - concurrency=5로 Gemini API rate limit 대응
 */
@Processor(AI_SUGGESTION_QUEUE, {
	concurrency: 5,
	lockDuration: 60_000,
	stalledInterval: 60_000,
})
export class SuggestionAnalysisProcessor extends WorkerHost {
	readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

	/** @see SuggestionAnalysisJob — 순환 참조 방지를 위해 setter injection */
	#suggestionJob!: SuggestionAnalysisJob;
	setSuggestionJob(job: SuggestionAnalysisJob) {
		this.#suggestionJob = job;
	}

	constructor(
		private readonly aiSuggestionService: AiSuggestionService,
		private readonly notificationService: NotificationService,
	) {
		super();
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: Job<AiSuggestionJobData>): Promise<void> {
		if (job.name === AiSuggestionJobName.DISPATCH) {
			await this.#suggestionJob.dispatchAnalysis(job);
			return;
		}

		if (job.name !== AiSuggestionJobName.ANALYZE) {
			this.#logger.warn(`Unknown job name: ${job.name}`);
			return;
		}

		const { userId, timezone } =
			job.data as AiSuggestionJobMap[typeof AiSuggestionJobName.ANALYZE];

		this.#logger.debug(`Processing suggestion analysis: userId=${userId}`);

		const createdCount =
			await this.aiSuggestionService.analyzeAndCreateSuggestions(
				userId,
				timezone,
			);

		if (createdCount === 0) {
			this.#logger.debug(
				`Suggestion analysis skipped (no patterns): userId=${userId}`,
			);
			return;
		}

		const message = NotificationMessageBuilder.aiSuggestion();
		await this.notificationService.createAndSend({
			userId,
			type: "AI_SUGGESTION",
			title: message.title,
			body: message.body,
		});

		this.#logger.log(
			`Suggestion analysis complete: userId=${userId}, created=${createdCount}`,
		);
	}
}
