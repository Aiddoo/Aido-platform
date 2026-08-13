import {
	Inject,
	Injectable,
	Logger,
	type OnModuleInit,
	Optional,
} from "@nestjs/common";
import {
	NotificationFacade,
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "@/notification";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import {
	fromLegacyJob,
	type NamedJob,
} from "@/shared/infrastructure/jobs/named-job";
import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case";
import type { SuggestionAnalysisJob } from "../jobs/suggestion-analysis.job";
import {
	AI_SUGGESTION_LEGACY_QUEUE,
	AI_SUGGESTION_QUEUE,
	type AiSuggestionAnalyzeData,
	type AiSuggestionJobMap,
	AiSuggestionJobName,
} from "../queue/ai-suggestion-queue";

/** ANALYZE 잡 데이터 내로잉 (as 캐스트 회피) */
function isAnalyzeData(
	data: AiSuggestionJobMap[keyof AiSuggestionJobMap],
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
type AiSuggestionJob = NamedJob<AiSuggestionJobMap>;
type AiSuggestionJobLike = {
	readonly name: string;
	readonly data: AiSuggestionJobMap[keyof AiSuggestionJobMap];
};

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
		private readonly notificationService: NotificationFacade,
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
			{ teamSize: 5, pollingIntervalSeconds: 2 },
		);
		await this.runtime.work<JobData>(
			AI_SUGGESTION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs)
					await this.process(fromLegacyJob<AiSuggestionJobMap>(job));
			},
			{ teamSize: 5, pollingIntervalSeconds: 2 },
		);
	}

	onStalled(jobId: string): void {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error): void {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	onFailed(
		job: { readonly id?: string; readonly name?: string } | undefined,
		error: Error,
	) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: AiSuggestionJobLike): Promise<void> {
		if (job.name === AiSuggestionJobName.DISPATCH) {
			await this.#suggestionJob?.dispatchAnalysis();
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

		const createdCount = await this.analyzeAndCreateSuggestionsUseCase.execute(
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
			purpose: "ENGAGEMENT",
			campaignKey: "ai_suggestion_v1",
			title: message.title,
			body: message.body,
		});

		this.#logger.log(
			`Suggestion analysis complete: userId=${userId}, created=${createdCount}`,
		);
	}
}
