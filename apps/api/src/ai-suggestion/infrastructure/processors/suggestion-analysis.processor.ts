import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import {
	NotificationMessageBuilder,
	NotificationService,
	resolveTemplateLocale,
} from "@/notification";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { AiSuggestionFacade } from "../../application/facades/ai-suggestion.facade";
import type { SuggestionAnalysisJob } from "../jobs/suggestion-analysis.job";
import {
	AI_SUGGESTION_QUEUE,
	type AiSuggestionAnalyzeData,
	type AiSuggestionJobData,
	AiSuggestionJobName,
} from "../queue/ai-suggestion-queue";

/** ANALYZE 잡 데이터 내로잉 (as 캐스트 회피) */
function isAnalyzeData(
	data: AiSuggestionJobData,
): data is AiSuggestionAnalyzeData {
	return "userId" in data;
}

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
	#suggestionJob?: SuggestionAnalysisJob;
	setSuggestionJob(job: SuggestionAnalysisJob) {
		this.#suggestionJob = job;
	}

	constructor(
		private readonly aiSuggestionFacade: AiSuggestionFacade,
		private readonly notificationService: NotificationService,
		private readonly database: DatabaseService,
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
			await this.#suggestionJob?.dispatchAnalysis(job);
			return;
		}

		if (job.name !== AiSuggestionJobName.ANALYZE || !isAnalyzeData(job.data)) {
			this.#logger.warn(`Unknown job name: ${job.name}`);
			return;
		}

		const { userId, timezone, weatherGrid } = job.data;

		this.#logger.debug(`Processing suggestion analysis: userId=${userId}`);

		// 제안 문구(AI 생성)와 푸시 알림이 같은 언어를 쓰도록 분석 전에 locale을 조회한다
		const preference = await this.database.userPreference.findUnique({
			where: { userId },
			select: { locale: true },
		});
		const locale = resolveTemplateLocale(preference?.locale);

		const createdCount =
			await this.aiSuggestionFacade.analyzeAndCreateSuggestions(
				userId,
				timezone,
				weatherGrid,
				locale,
			);

		if (createdCount === 0) {
			this.#logger.debug(
				`Suggestion analysis skipped (no patterns): userId=${userId}`,
			);
			return;
		}

		const message = NotificationMessageBuilder.aiSuggestion(locale);
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
