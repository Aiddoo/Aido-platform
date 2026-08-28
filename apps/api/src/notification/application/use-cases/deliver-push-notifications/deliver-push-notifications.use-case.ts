import { Inject, Injectable, Logger } from "@nestjs/common";

import type { CreateNotificationData } from "../../ports/notification-data";
import {
	PUSH_DISPATCH_REPOSITORY,
	type PushDispatchRecord,
	type PushDispatchRepositoryPort,
	type PushDispatchSkipReason,
} from "../../ports/push-dispatch.repository.port";
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
	PushDeliveryItem,
} from "../../types/push-delivery.types";

interface PushDispatchItem extends PushDeliveryItem {
	readonly dispatchId: number;
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

/** 영속 알림의 푸시 dispatch 상태 전이를 위에서 아래로 조율한다. */
@Injectable()
export class DeliverPushNotificationsUseCase {
	readonly #logger = new Logger(DeliverPushNotificationsUseCase.name);

	constructor(
		@Inject(PUSH_DISPATCH_REPOSITORY)
		private readonly pushDispatchRepository: PushDispatchRepositoryPort,
		private readonly eligibility: PushDeliveryEligibilityService,
		private readonly payloadFactory: PushNotificationPayloadFactory,
		private readonly delivery: PushNotificationDeliveryService,
	) {}

	execute(input: DeliverPushNotificationsInput): Promise<void> {
		return input.mode === "single"
			? this.#deliverSingle(input.item)
			: this.#deliverBatch(input.items);
	}

	async #deliverSingle(item: PushDeliveryItem): Promise<void> {
		const recipient = await this.eligibility.loadSingleRecipient(item.data.userId);
		const dispatch = await this.pushDispatchRepository.createPushDispatch({
			notificationId: item.notificationId,
			userId: item.data.userId,
			purpose: item.data.purpose ?? "TRANSACTIONAL",
			campaignKey: item.data.campaignKey,
			variantId: item.data.variantId,
			timezone: recipient.timezone,
			localDate: new Date(`${recipient.localDate}T00:00:00.000Z`),
		});

		try {
			const eligibility = await this.eligibility.evaluateSingle(item.data, recipient);
			if (eligibility.status === "skipped") {
				await this.#markSingleSkipped(dispatch.id, item.data, eligibility.reason);
				return;
			}

			const delivery = await this.delivery.deliverSingle({
				data: item.data,
				payload: this.payloadFactory.createSingle({
					data: item.data,
					notificationId: item.notificationId,
					dispatchId: dispatch.id,
				}),
			});
			if (delivery.status === "skipped") {
				await this.#markSingleSkipped(dispatch.id, item.data, delivery.reason);
				return;
			}

			await this.pushDispatchRepository.recordPushDeliveryResults(dispatch.id, delivery.results);
		} catch (error) {
			await this.#markUnexpectedDispatchFailure([dispatch.id], error);
			throw error;
		}
	}

	async #deliverBatch(items: readonly PushDeliveryItem[]): Promise<void> {
		const recipients = await this.eligibility.loadBatchRecipients(
			items.map((item) => item.data.userId),
		);
		let createdDispatchIds: number[] = [];

		try {
			const dispatchRecords = await this.#createBatchDispatchRecords(items, recipients);
			createdDispatchIds = dispatchRecords.map((dispatch) => dispatch.id);
			const dispatchItems = this.#matchDispatchesToItems(items, dispatchRecords);

			const settings = partitionEligibility(
				this.eligibility.evaluateBatchSettings(dispatchItems, recipients),
			);
			const skippedDispatches = settings.skipped.map(({ candidate, reason }) => {
				this.#logSkipped(candidate.data, reason);
				return { dispatchId: candidate.dispatchId, reason };
			});
			if (settings.eligible.length === 0) {
				await this.pushDispatchRepository.markPushDispatchesSkipped(skippedDispatches);
				return;
			}

			const rateLimit = partitionEligibility(
				await this.eligibility.reserveBatch(settings.eligible, recipients),
			);
			for (const { candidate, reason } of rateLimit.skipped) {
				this.#logSkipped(candidate.data, reason);
				skippedDispatches.push({ dispatchId: candidate.dispatchId, reason });
			}
			await this.pushDispatchRepository.markPushDispatchesSkipped(skippedDispatches);
			if (rateLimit.eligible.length === 0) return;

			const preparedDelivery = await this.delivery.prepareBatchDelivery(
				rateLimit.eligible.map((item) =>
					this.payloadFactory.createBatch({
						data: item.data,
						notificationId: item.notificationId,
						dispatchId: item.dispatchId,
					}),
				),
			);
			for (const skipped of preparedDelivery.skippedDispatches) {
				await this.pushDispatchRepository.markPushDispatchSkipped(
					skipped.dispatchId,
					skipped.reason,
				);
			}
			const delivery =
				preparedDelivery.status === "ready"
					? await this.delivery.sendPreparedBatch(preparedDelivery)
					: {
							attemptedDispatchIds: preparedDelivery.attemptedDispatchIds,
							resultsByDispatch: new Map<number, PushResult[]>(),
						};
			await this.pushDispatchRepository.recordPushDeliveryResultsBatch(
				[...delivery.attemptedDispatchIds].map((dispatchId) => ({
					dispatchId,
					results: delivery.resultsByDispatch.get(dispatchId) ?? [],
				})),
			);
		} catch (error) {
			await this.#markUnexpectedDispatchFailure(createdDispatchIds, error);
			throw error;
		}
	}

	#createBatchDispatchRecords(
		items: readonly PushDeliveryItem[],
		recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
	): Promise<PushDispatchRecord[]> {
		return this.pushDispatchRepository.createPushDispatches(
			items.map((item) => {
				const recipient = recipients.get(item.data.userId);
				if (!recipient) {
					throw new Error(`Push delivery recipient missing: userId=${item.data.userId}`);
				}
				return {
					notificationId: item.notificationId,
					userId: item.data.userId,
					purpose: item.data.purpose ?? "TRANSACTIONAL",
					campaignKey: item.data.campaignKey,
					variantId: item.data.variantId,
					timezone: recipient.timezone,
					localDate: new Date(`${recipient.localDate}T00:00:00.000Z`),
				};
			}),
		);
	}

	#matchDispatchesToItems(
		items: readonly PushDeliveryItem[],
		dispatchRecords: readonly PushDispatchRecord[],
	): PushDispatchItem[] {
		const dispatchIdByNotificationId = new Map(
			dispatchRecords.map((dispatch) => [dispatch.notificationId, dispatch.id]),
		);

		return items.map((item) => {
			const dispatchId = dispatchIdByNotificationId.get(item.notificationId);
			if (dispatchId === undefined) {
				throw new Error(
					`Push dispatch batch result missing: notificationId=${item.notificationId}`,
				);
			}
			return { ...item, dispatchId };
		});
	}

	async #markSingleSkipped(
		dispatchId: number,
		data: CreateNotificationData,
		reason: PushDispatchSkipReason,
	): Promise<void> {
		this.#logSkipped(data, reason);
		await this.pushDispatchRepository.markPushDispatchSkipped(dispatchId, reason);
	}

	#logSkipped(data: CreateNotificationData, reason: PushDispatchSkipReason): void {
		this.#logger.debug(
			`Push dispatch skipped: userId=${data.userId}, type=${data.type}, reason=${reason}`,
		);
	}

	async #markUnexpectedDispatchFailure(
		dispatchIds: number[],
		originalError: unknown,
	): Promise<void> {
		if (dispatchIds.length === 0) return;
		try {
			await this.pushDispatchRepository.markPushDispatchFailed(
				dispatchIds,
				"UNEXPECTED_DISPATCH_ERROR",
			);
		} catch (transitionError) {
			this.#logger.error(
				`Failed to mark push dispatches FAILED: dispatchIds=${dispatchIds.join(",")}, originalError=${originalError}, transitionError=${transitionError}`,
			);
		}
	}
}
