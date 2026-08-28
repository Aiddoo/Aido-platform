import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { decideRetentionOutboxRetry } from "../../policies/retention-outbox-retry.policy";
import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_PUSH_SENDER,
	type RetentionPushSenderPort,
} from "../../ports/retention-push-sender.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

@Injectable()
export class DispatchRetentionPushUseCase {
	readonly #logger = new Logger(DispatchRetentionPushUseCase.name);
	constructor(
		@Inject(RETENTION_REPOSITORY)
		private readonly repository: RetentionRepositoryPort,
		@Inject(RETENTION_PUSH_SENDER)
		private readonly sender: RetentionPushSenderPort,
		@Inject(RETENTION_CONFIG)
		private readonly config: RetentionConfigPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly processingJobId: string;
		readonly processingJobAttempt: number;
		readonly isFinalAttempt: boolean;
	}): Promise<void> {
		if (!this.config.enabled) {
			await this.uow.run(() =>
				this.repository.deferOutbox({
					outboxId: input.outboxId,
					publishAttempt: input.publishAttempt,
					availableAt: new Date(Date.now() + 60_000),
				}),
			);
			return;
		}
		let candidate: Awaited<ReturnType<RetentionRepositoryPort["claimDispatch"]>>;
		try {
			candidate = await this.uow.run(() =>
				this.repository.claimDispatch({ ...input, startedAt: new Date() }),
			);
		} catch (claimError) {
			if (input.isFinalAttempt) await this.#recoverFinalClaimFailure(input, claimError);
			throw claimError;
		}
		if (!candidate) return;
		try {
			const now = new Date();
			if (!this.sender.isEligible(candidate, now)) {
				await this.uow.run(() =>
					this.repository.markDispatchSkipped(candidate.fence, "INELIGIBLE_AT_DISPATCH"),
				);
				return;
			}
			if (!candidate.rateLimitReserved) {
				if (!(await this.sender.reserveRateLimit(candidate, now))) {
					await this.uow.run(() =>
						this.repository.markDispatchSkipped(candidate.fence, "RATE_LIMITED_AT_DISPATCH"),
					);
					return;
				}
				await this.uow.run(async () => {
					const reserved = await this.repository.markRateLimitReserved(candidate.fence, new Date());
					if (!reserved) throw new Error("Retention rate-limit reservation fence mismatch");
				});
			}
			const results = await this.sender.send(candidate);
			await this.uow.run(() => this.repository.recordDeliveryResults(candidate.fence, results));
		} catch (error) {
			const retry = decideRetentionOutboxRetry(candidate.fence.publishAttempt);
			await this.uow.run(() =>
				this.repository.releaseDispatchForRetry({
					fence: candidate.fence,
					reason: error instanceof Error ? error.message : String(error),
					availableAt: new Date(Date.now() + retry.delayMs),
					hasExhaustedRetries: retry.hasExhaustedRetries,
				}),
			);
			throw error;
		}
	}

	async #recoverFinalClaimFailure(
		input: { readonly outboxId: string; readonly publishAttempt?: number },
		claimError: unknown,
	): Promise<void> {
		const reason = claimError instanceof Error ? claimError.message : String(claimError);
		try {
			await this.uow.run(async () => {
				const recovered = await this.repository.reopenUnclaimedDispatch({
					outboxId: input.outboxId,
					publishAttempt: input.publishAttempt,
					availableAt: new Date(),
					reason,
				});
				if (!recovered) throw new Error("Retention final claim recovery fence mismatch");
			});
		} catch (recoveryError) {
			this.#logger.error(
				`Failed to reopen retention publication after final claim error: outboxId=${input.outboxId}, claimError=${reason}, recoveryError=${recoveryError}`,
			);
		}
	}
}
