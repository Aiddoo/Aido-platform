import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { AiSuggestionService } from "../ai-suggestion.service";

// =============================================================================
// Constants & Types
// =============================================================================

export const AI_SUGGESTION_QUEUE = "ai-suggestion-analysis";

export interface AiSuggestionJobData {
	userId: string;
	timezone: string;
}

// =============================================================================
// Processor
// =============================================================================

/**
 * AI 반복 제안 분석 BullMQ 프로세서
 *
 * - 단일 사용자 패턴 분석 + 알림 발송
 * - BullMQ 자동 재시도 (3회, exponential backoff)
 * - concurrency=5로 Gemini API rate limit 대응
 */
@Processor(AI_SUGGESTION_QUEUE, { concurrency: 5 })
export class SuggestionAnalysisProcessor extends WorkerHost {
	readonly #logger = new Logger(SuggestionAnalysisProcessor.name);

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

	async process(job: Job<AiSuggestionJobData>): Promise<void> {
		const { userId, timezone } = job.data;

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
