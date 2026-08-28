import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { pushDeliveryOutboxRetryDelayMs } from "../../policies/push-delivery-outbox-retry.policy";
import {
	PUSH_DELIVERY_JOB_ENQUEUER,
	type PushDeliveryJobEnqueuerPort,
} from "../../ports/push-delivery-job-enqueuer.port";
import {
	PUSH_DELIVERY_OUTBOX_REPOSITORY,
	type PushDeliveryOutboxRepositoryPort,
} from "../../ports/push-delivery-outbox.repository.port";
import type { PushDeliveryPublication } from "../../types/push-delivery.types";

const DELIVERY_JOB_BATCH_SIZE = 100;

export type PublishPushDeliveryOutboxInput =
	| {
			readonly kind: "dispatches";
			readonly dispatchIds: readonly number[];
	  }
	| {
			readonly kind: "available";
			readonly limit: number;
	  };

@Injectable()
export class PublishPushDeliveryOutboxUseCase {
	readonly #logger = new Logger(PublishPushDeliveryOutboxUseCase.name);

	constructor(
		@Inject(PUSH_DELIVERY_OUTBOX_REPOSITORY)
		private readonly outbox: PushDeliveryOutboxRepositoryPort,
		@Inject(PUSH_DELIVERY_JOB_ENQUEUER)
		private readonly enqueuer: PushDeliveryJobEnqueuerPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: PublishPushDeliveryOutboxInput): Promise<number> {
		if (input.kind === "available") {
			const claimed = await this.uow.run(() =>
				this.outbox.claimAvailable({
					limit: Math.min(input.limit, DELIVERY_JOB_BATCH_SIZE),
					lockedAt: new Date(),
				}),
			);
			return this.#publish(claimed);
		}

		let publishedCount = 0;
		for (let offset = 0; offset < input.dispatchIds.length; offset += DELIVERY_JOB_BATCH_SIZE) {
			const dispatchIds = input.dispatchIds.slice(offset, offset + DELIVERY_JOB_BATCH_SIZE);
			const claimed = await this.uow.run(() =>
				this.outbox.claimByDispatchIds(dispatchIds, new Date()),
			);
			publishedCount += await this.#publish(claimed);
		}
		return publishedCount;
	}

	async #publish(publications: readonly PushDeliveryPublication[]): Promise<number> {
		if (publications.length === 0) return 0;
		try {
			// JobRuntime의 null(동일 idempotency key)은 이미 발행된 동일 generation으로 성공이다.
			await this.enqueuer.enqueueDeliveries(publications);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const highestAttempt = Math.max(...publications.map((item) => item.publishAttempt));
			await this.uow.run(() =>
				this.outbox.defer({
					publications,
					availableAt: new Date(Date.now() + pushDeliveryOutboxRetryDelayMs(highestAttempt)),
					error: message,
				}),
			);
			this.#logger.warn(
				`Push delivery enqueue deferred: dispatchIds=${publications.map((item) => item.dispatchId).join(",")}, error=${message}`,
			);
			return 0;
		}

		try {
			return await this.uow.run(() => this.outbox.markPublished(publications, new Date()));
		} catch (error) {
			// enqueue 성공 여부가 확정된 뒤에는 generation을 되돌리지 않는다.
			// PROCESSING lease recovery가 같은 generation 또는 새 generation으로 안전하게 복구한다.
			this.#logger.warn(
				`Push delivery outbox publish mark failed: dispatchIds=${publications.map((item) => item.dispatchId).join(",")}, error=${error}`,
			);
			return 0;
		}
	}
}
