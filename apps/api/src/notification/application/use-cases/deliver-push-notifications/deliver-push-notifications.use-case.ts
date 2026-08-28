import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { PushDeliveryClaimRecoveryConflictError } from "../../errors/push-delivery-claim-recovery-conflict.error";
import { PushDeliveryRateLimitReservationConflictError } from "../../errors/push-delivery-rate-limit-reservation-conflict.error";
import { pushDeliveryOutboxRetryDelayMs } from "../../policies/push-delivery-outbox-retry.policy";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type ClaimedPushDelivery,
	type PushDeliveryContext,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port";
import type { PushResult } from "../../ports/push-provider.port";
import {
	type BatchPushDeliveryRecipient,
	PushDeliveryEligibilityService,
	type PushDeliveryEligibilityDecision,
} from "../../services/push-delivery-eligibility.service";
import { PushNotificationDeliveryService } from "../../services/push-notification-delivery.service";
import { PushNotificationPayloadFactory } from "../../services/push-notification-payload.factory";
import type {
	DeliverPushNotificationsInput,
	PushDispatchSkipReason,
} from "../../types/push-delivery.types";

interface ClaimedBatchCandidate {
	readonly claimed: ClaimedPushDelivery;
	readonly dispatchId: number;
	readonly data: CreateNotificationData;
	readonly rateLimitDispatchId: number;
}

interface PartitionedEligibility<TCandidate> {
	readonly eligible: TCandidate[];
	readonly skipped: Array<{
		readonly candidate: TCandidate;
		readonly reason: PushDispatchSkipReason;
	}>;
}

function partitionEligibility<TCandidate>(
	decisions: readonly PushDeliveryEligibilityDecision<TCandidate>[],
): PartitionedEligibility<TCandidate> {
	const eligible: TCandidate[] = [];
	const skipped: PartitionedEligibility<TCandidate>["skipped"] = [];
	for (const decision of decisions) {
		if (decision.status === "eligible") eligible.push(decision.candidate);
		else skipped.push({ candidate: decision.candidate, reason: decision.reason });
	}
	return { eligible, skipped };
}

/**
 * Durable queue에서 claim한 일반 push를 기존 단건/배치 정책으로 전달한다.
 *
 * Expo가 ticket을 수락한 직후 프로세스가 종료되면 동일 알림이 재전달될 수 있다.
 * DB fence는 stale worker의 상태 덮어쓰기를 막지만 외부 provider까지 exactly-once로 만들지는 않는다.
 */
@Injectable()
export class DeliverPushNotificationsUseCase {
	readonly #logger = new Logger(DeliverPushNotificationsUseCase.name);

	constructor(
		@Inject(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
		private readonly lifecycle: PushDeliveryLifecycleRepositoryPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
		private readonly eligibility: PushDeliveryEligibilityService,
		private readonly payloadFactory: PushNotificationPayloadFactory,
		private readonly delivery: PushNotificationDeliveryService,
	) {}

	async execute(input: DeliverPushNotificationsInput): Promise<void> {
		const claimed = await this.#claim(input);
		if (claimed.length === 0) return;

		try {
			for (const delivery of claimed.filter((item) => item.deliveryMode === "SINGLE")) {
				await this.#deliverSingle(delivery);
			}
			await this.#deliverBatch(claimed.filter((item) => item.deliveryMode === "BATCH"));
		} catch (error) {
			await this.#release(claimed, error, input.isFinalAttempt);
			throw error;
		}
	}

	async #deliverSingle(claimed: ClaimedPushDelivery): Promise<void> {
		const { data } = claimed.item;
		const recipient = await this.eligibility.loadSingleRecipient(data.userId);
		const context = this.#context(recipient.timezone, recipient.localDate);
		const eligibility = await this.eligibility.evaluateSingle(
			data,
			recipient,
			claimed.fence.dispatchId,
			claimed.rateLimitReservation.status === "reserved",
		);
		if (eligibility.status === "skipped") {
			await this.#finalizeSkipped(claimed, context, eligibility.reason);
			return;
		}
		if (claimed.rateLimitReservation.status === "pending") {
			await this.#markRateLimitReserved([claimed]);
		}

		const delivery = await this.delivery.deliverSingle({
			data,
			payload: this.payloadFactory.createSingle({
				data,
				notificationId: claimed.item.notificationId,
				dispatchId: claimed.fence.dispatchId,
			}),
		});
		if (delivery.status === "skipped") {
			await this.#finalizeSkipped(claimed, context, delivery.reason);
			return;
		}

		await this.uow.run(() =>
			this.lifecycle.finalizeResults([
				{ fence: claimed.fence, context, results: delivery.results },
			]),
		);
	}

	async #deliverBatch(claimed: readonly ClaimedPushDelivery[]): Promise<void> {
		if (claimed.length === 0) return;
		const candidates = claimed.map<ClaimedBatchCandidate>((item) => ({
			claimed: item,
			dispatchId: item.fence.dispatchId,
			data: item.item.data,
			rateLimitDispatchId: item.fence.dispatchId,
		}));
		const contexts = new Map<number, PushDeliveryContext>();
		const recipients = await this.eligibility.loadBatchRecipients(
			candidates.map((candidate) => candidate.data.userId),
		);
		this.#addBatchContexts(candidates, recipients, contexts);
		const settings = partitionEligibility(
			this.eligibility.evaluateBatchSettings(candidates, recipients),
		);
		await this.#finalizeBatchSkipped(settings.skipped, contexts);

		const reserved = settings.eligible.filter(
			(candidate) => candidate.claimed.rateLimitReservation.status === "reserved",
		);
		const pendingReservation = settings.eligible.filter(
			(candidate) => candidate.claimed.rateLimitReservation.status === "pending",
		);
		const rateLimit = partitionEligibility(
			await this.eligibility.reserveBatch(pendingReservation, recipients),
		);
		await this.#finalizeBatchSkipped(rateLimit.skipped, contexts);
		const newlyReserved = await this.#markRateLimitReserved(
			rateLimit.eligible.map((candidate) => candidate.claimed),
		);
		const approvedDispatchIds = new Set([
			...reserved.map((candidate) => candidate.dispatchId),
			...newlyReserved,
		]);
		const eligible = candidates.filter((candidate) =>
			approvedDispatchIds.has(candidate.dispatchId),
		);
		if (eligible.length === 0) return;

		const prepared = await this.delivery.prepareBatchDelivery(
			eligible.map((candidate) =>
				this.payloadFactory.createBatch({
					data: candidate.data,
					notificationId: candidate.claimed.item.notificationId,
					dispatchId: candidate.dispatchId,
				}),
			),
		);
		const candidateByDispatchId = new Map(
			eligible.map((candidate) => [candidate.dispatchId, candidate]),
		);
		await this.#finalizeBatchSkipped(
			prepared.skippedDispatches.flatMap((skipped) => {
				const candidate = candidateByDispatchId.get(skipped.dispatchId);
				return candidate ? [{ candidate, reason: skipped.reason }] : [];
			}),
			contexts,
		);

		const result =
			prepared.status === "ready"
				? await this.delivery.sendPreparedBatch(prepared)
				: {
						attemptedDispatchIds: prepared.attemptedDispatchIds,
						resultsByDispatch: new Map<number, PushResult[]>(),
					};
		const finalizations = [...result.attemptedDispatchIds].flatMap((dispatchId) => {
			const candidate = candidateByDispatchId.get(dispatchId);
			const context = contexts.get(dispatchId);
			return candidate && context
				? [
						{
							fence: candidate.claimed.fence,
							context,
							results: result.resultsByDispatch.get(dispatchId) ?? [],
						},
					]
				: [];
		});
		await this.uow.run(() => this.lifecycle.finalizeResults(finalizations));
	}

	#addBatchContexts(
		candidates: readonly ClaimedBatchCandidate[],
		recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
		contexts: Map<number, PushDeliveryContext>,
	): void {
		for (const candidate of candidates) {
			const recipient = recipients.get(candidate.data.userId);
			if (!recipient) {
				throw new Error(`Push delivery recipient missing: userId=${candidate.data.userId}`);
			}
			contexts.set(candidate.dispatchId, this.#context(recipient.timezone, recipient.localDate));
		}
	}

	async #markRateLimitReserved(
		claimedDeliveries: readonly ClaimedPushDelivery[],
	): Promise<Set<number>> {
		if (claimedDeliveries.length === 0) return new Set();
		const reservedAt = new Date();
		const reserved = await this.uow.run(async () => {
			const reservedDispatchIds = await this.lifecycle.markRateLimitReserved(
				claimedDeliveries.map((claimed) => ({
					fence: claimed.fence,
					reservedAt,
				})),
			);
			if (reservedDispatchIds.length !== claimedDeliveries.length) {
				const reservedIds = new Set(reservedDispatchIds);
				throw new PushDeliveryRateLimitReservationConflictError(
					claimedDeliveries
						.map((claimed) => claimed.fence.dispatchId)
						.filter((dispatchId) => !reservedIds.has(dispatchId)),
				);
			}
			return reservedDispatchIds;
		});
		return new Set(reserved);
	}

	async #claim(input: DeliverPushNotificationsInput): Promise<readonly ClaimedPushDelivery[]> {
		try {
			return await this.uow.run(() =>
				this.lifecycle.claim({
					publications: input.publications,
					processingJobId: input.processingJobId,
					processingJobAttempt: input.processingJobAttempt,
					startedAt: new Date(),
				}),
			);
		} catch (claimError) {
			if (input.isFinalAttempt) {
				await this.#recoverFinalClaimFailure(input, claimError);
			}
			throw claimError;
		}
	}

	async #recoverFinalClaimFailure(
		input: DeliverPushNotificationsInput,
		claimError: unknown,
	): Promise<void> {
		const message = claimError instanceof Error ? claimError.message : String(claimError);
		try {
			await this.uow.run(async () => {
				const recovered = await this.lifecycle.reopenAfterFinalClaimFailure({
					publications: input.publications,
					availableAt: new Date(),
					error: message,
				});
				if (recovered !== input.publications.length) {
					throw new PushDeliveryClaimRecoveryConflictError(input.publications.length, recovered);
				}
			});
		} catch (recoveryError) {
			this.#logger.error(
				`Failed to reopen push publications after final claim error: dispatchIds=${input.publications.map((item) => item.dispatchId).join(",")}, claimError=${message}, recoveryError=${recoveryError}`,
			);
		}
	}

	async #finalizeBatchSkipped(
		skipped: readonly {
			readonly candidate: ClaimedBatchCandidate;
			readonly reason: PushDispatchSkipReason;
		}[],
		contexts: ReadonlyMap<number, PushDeliveryContext>,
	): Promise<void> {
		const finalizations = skipped.flatMap(({ candidate, reason }) => {
			const context = contexts.get(candidate.dispatchId);
			if (!context) return [];
			this.#logSkipped(candidate.data, reason);
			return [{ fence: candidate.claimed.fence, context, reason }];
		});
		await this.uow.run(() => this.lifecycle.finalizeSkipped(finalizations));
	}

	async #finalizeSkipped(
		claimed: ClaimedPushDelivery,
		context: PushDeliveryContext,
		reason: PushDispatchSkipReason,
	): Promise<void> {
		this.#logSkipped(claimed.item.data, reason);
		await this.uow.run(() =>
			this.lifecycle.finalizeSkipped([{ fence: claimed.fence, context, reason }]),
		);
	}

	#context(timezone: string, localDate: string): PushDeliveryContext {
		return { timezone, localDate: new Date(`${localDate}T00:00:00.000Z`) };
	}

	#logSkipped(data: CreateNotificationData, reason: PushDispatchSkipReason): void {
		this.#logger.debug(
			`Push dispatch skipped: userId=${data.userId}, type=${data.type}, reason=${reason}`,
		);
	}

	async #release(
		claimed: readonly ClaimedPushDelivery[],
		error: unknown,
		isFinalAttempt: boolean,
	): Promise<void> {
		const message = error instanceof Error ? error.message : String(error);
		const now = Date.now();
		try {
			await this.uow.run(() =>
				this.lifecycle.release(
					claimed.map((item) => ({
						fence: item.fence,
						error: message,
						reopenOutbox: isFinalAttempt,
						availableAt: new Date(
							now +
								(isFinalAttempt ? pushDeliveryOutboxRetryDelayMs(item.fence.publishAttempt) : 0),
						),
					})),
				),
			);
		} catch (releaseError) {
			this.#logger.error(
				`Failed to release push delivery leases: dispatchIds=${claimed.map((item) => item.fence.dispatchId).join(",")}, originalError=${message}, releaseError=${releaseError}`,
			);
		}
	}
}
