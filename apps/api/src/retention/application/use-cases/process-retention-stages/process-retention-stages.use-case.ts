import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { RETENTION_CAMPAIGN_KEY } from "../../../domain/retention.constants";
import { retentionPushSkipReason } from "../../../domain/services/push-eligibility";
import { buildRetentionMessage } from "../../../domain/services/retention-message";
import {
	decideRetentionStage,
	localDateString,
} from "../../../domain/services/stage-policy";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
	type RetentionStageCandidate,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";

@Injectable()
export class ProcessRetentionStagesUseCase {
	readonly #logger = new Logger(ProcessRetentionStagesUseCase.name);

	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	async execute(): Promise<void> {
		if (!this.config.enabled) return;
		const candidates = await this.repository.findScheduledStages(200);
		for (const candidate of candidates) {
			try {
				await this.#processCandidate(candidate, new Date());
			} catch (error) {
				this.#logger.error(
					`Retention stage failed: stageId=${candidate.stageId}, error=${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}

	async #processCandidate(
		candidate: RetentionStageCandidate,
		now: Date,
	): Promise<void> {
		const returnedWithinWindow = Boolean(
			candidate.lastActiveAt &&
				localDateString(candidate.lastActiveAt, candidate.timezone) >
					localDateString(candidate.startedAt, candidate.timezone),
		);
		const activeToday = Boolean(
			candidate.lastActiveAt &&
				localDateString(candidate.lastActiveAt, candidate.timezone) ===
					localDateString(now, candidate.timezone),
		);

		if (candidate.variant === "CONTROL" && candidate.stage !== "D7") {
			await this.repository.markStageSkipped(
				candidate.stageId,
				"CONTROL_GROUP",
			);
			return;
		}

		const decision = decideRetentionStage(candidate.stage, {
			startedAt: candidate.startedAt,
			now,
			timezone: candidate.timezone,
			todoCount: candidate.todoCount,
			completedCount: candidate.completedCount,
			incompleteCount: candidate.incompleteCount,
			returnedWithinWindow,
			todoActionWithinWindow: candidate.todoActionWithinWindow,
			activeToday,
		});
		if (decision.kind === "WAIT") return;

		await this.uow.run(async () => {
			if (candidate.stage === "D7") {
				await this.repository.recordD7Result({
					assignmentId: candidate.assignmentId,
					returnedWithinD7: returnedWithinWindow,
					todoActionWithinD7: candidate.todoActionWithinWindow,
				});
			}

			if (candidate.variant === "CONTROL") {
				await this.repository.markStageSkipped(
					candidate.stageId,
					"CONTROL_MEASUREMENT_COMPLETE",
				);
				return;
			}
			if (decision.kind === "SKIP" || decision.kind === "EVALUATE_ONLY") {
				await this.repository.markStageSkipped(
					candidate.stageId,
					decision.reason,
				);
				return;
			}

			const skipReason = retentionPushSkipReason({
				pushEnabled: candidate.pushEnabled,
				marketingPushAgreedAt: candidate.marketingPushAgreedAt,
				activeTokenCount: candidate.activeTokenCount,
				timezone: candidate.timezone,
				now,
			});
			if (skipReason) {
				await this.repository.markStageSkipped(candidate.stageId, skipReason);
				return;
			}

			const message = buildRetentionMessage(
				candidate.stage,
				decision.variantId,
				candidate.locale,
			);
			await this.repository.createDelivery({
				stageId: candidate.stageId,
				userId: candidate.userId,
				timezone: candidate.timezone,
				title: message.title,
				body: message.body,
				route: decision.route,
				variantId: decision.variantId,
			});
		});

		this.#logger.debug(
			`Retention stage processed: campaign=${RETENTION_CAMPAIGN_KEY}, stage=${candidate.stage}, userId=${candidate.userId}`,
		);
	}
}
