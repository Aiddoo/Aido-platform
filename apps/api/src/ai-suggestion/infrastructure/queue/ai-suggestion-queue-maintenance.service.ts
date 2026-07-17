import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { toErrorMessage } from "@/shared/application/utils/error-message.util";
import { withTimeout } from "@/shared/application/utils/with-timeout.util";
import {
	AI_SUGGESTION_QUEUE,
	type AiSuggestionJobData,
} from "./ai-suggestion-queue";
import { AI_SUGGESTION_FAILED_JOB_RETENTION } from "./ai-suggestion-retention.policy";

const CLEANUP_TIMEOUT_MS = 2_000;

/** AI 제안 큐의 완료된 실패 기록만 보존 정책에 맞춰 정리한다. */
@Injectable()
export class AiSuggestionQueueMaintenanceService {
	readonly #logger = new Logger(AiSuggestionQueueMaintenanceService.name);

	constructor(
		@InjectQueue(AI_SUGGESTION_QUEUE)
		private readonly queue: Queue<AiSuggestionJobData>,
	) {}

	async cleanExpiredFailures(): Promise<number> {
		try {
			const removedJobIds = await withTimeout(
				this.queue.clean(
					AI_SUGGESTION_FAILED_JOB_RETENTION.age * 1_000,
					AI_SUGGESTION_FAILED_JOB_RETENTION.count,
					"failed",
				),
				CLEANUP_TIMEOUT_MS,
				"AI suggestion failed job cleanup",
			);
			if (removedJobIds.length > 0) {
				this.#logger.log(
					`Expired suggestion failures cleaned: count=${removedJobIds.length}`,
				);
			}
			return removedJobIds.length;
		} catch (error) {
			this.#logger.warn(
				`Failed to clean expired suggestion failures: ${toErrorMessage(error)}`,
			);
			return 0;
		}
	}
}
