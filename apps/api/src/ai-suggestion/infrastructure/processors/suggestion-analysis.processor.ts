import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { createAiSuggestionNotificationMessage, NotificationSender } from "@/notification";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { toSupportedLocale } from "@/shared/domain/locale";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { fromLegacyJob, type NamedJob } from "@/shared/infrastructure/jobs/named-job";

import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case";
import type { SuggestionAnalysisJob } from "../jobs/suggestion-analysis.job";
import {
	AI_SUGGESTION_LEGACY_QUEUE,
	AI_SUGGESTION_QUEUE,
	AI_SUGGESTION_WORKER_POLICY,
	type AiSuggestionJobMap,
	AiSuggestionJobName,
	AiSuggestionRuntimeJobSchema,
} from "../queue/ai-suggestion-queue";

/**
 * AI 반복 제안 분석 BullMQ 프로세서
 *
 * - dispatch-analysis: 스케줄러 트리거 → per-user 잡 등록
 * - analyze-suggestion: 단일 사용자 패턴 분석 + 알림 발송
 * - BullMQ 자동 재시도 (3회, exponential backoff)
 * - concurrency=5로 Gemini API rate limit 대응
 */
type AiSuggestionJob = NamedJob<AiSuggestionJobMap>;
type AiSuggestionJobLike = {
	readonly name: string;
	readonly data: JobData;
};

/** AI 제안 푸시의 카피 성과를 이전 문구와 분리한다. */
const AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY = "ai_suggestion_v2";

@Injectable()
export class SuggestionAnalysisProcessor implements OnModuleInit {
	readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

	/** @see SuggestionAnalysisJob — 순환 참조 방지를 위해 setter injection */
	#suggestionJob?: SuggestionAnalysisJob;
	setSuggestionJob(job: SuggestionAnalysisJob) {
		this.#suggestionJob = job;
	}

	constructor(
		private readonly analyzeAndCreateSuggestionsUseCase: AnalyzeAndCreateSuggestionsUseCase,
		private readonly notificationService: NotificationSender,
		private readonly database: DatabaseService,
		@Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<AiSuggestionJob>(
			AI_SUGGESTION_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			AI_SUGGESTION_WORKER_POLICY,
		);
		await this.runtime.work<JobData>(
			AI_SUGGESTION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(fromLegacyJob<AiSuggestionJobMap>(job));
			},
			AI_SUGGESTION_WORKER_POLICY,
		);
	}

	onStalled(jobId: string): void {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error): void {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(untrustedJob: AiSuggestionJobLike): Promise<void> {
		const parsedJob = AiSuggestionRuntimeJobSchema.safeParse(untrustedJob);
		if (!parsedJob.success) {
			this.#logger.warn(`Invalid AI suggestion job: name=${untrustedJob.name}`);
			return;
		}
		const job = parsedJob.data;
		if (job.name === AiSuggestionJobName.DISPATCH) {
			await this.#suggestionJob?.dispatchAnalysis();
			return;
		}

		const { userId, timezone, weatherGrid } = job.data;

		this.#logger.debug(`Processing suggestion analysis: userId=${userId}`);

		// 제안 문구(AI 생성)와 푸시 알림이 같은 언어를 쓰도록 분석 전에 locale을 조회한다
		const preference = await this.database.userPreference.findUnique({
			where: { userId },
			select: { locale: true },
		});
		const locale = toSupportedLocale(preference?.locale);

		const createdCount = await this.analyzeAndCreateSuggestionsUseCase.execute(
			userId,
			timezone,
			weatherGrid,
			locale,
		);

		if (createdCount === 0) {
			this.#logger.debug(`Suggestion analysis skipped (no patterns): userId=${userId}`);
			return;
		}

		const message = createAiSuggestionNotificationMessage({ locale });
		await this.notificationService.createAndSend({
			userId,
			type: "AI_SUGGESTION",
			purpose: "ENGAGEMENT",
			campaignKey: AI_SUGGESTION_NOTIFICATION_CAMPAIGN_KEY,
			variantId: message.variantId,
			title: message.title,
			body: message.body,
		});

		this.#logger.log(`Suggestion analysis complete: userId=${userId}, created=${createdCount}`);
	}
}
