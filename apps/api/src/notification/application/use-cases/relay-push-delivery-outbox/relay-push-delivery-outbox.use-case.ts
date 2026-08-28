import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port";
import {
	PUSH_DELIVERY_OUTBOX_REPOSITORY,
	type PushDeliveryOutboxRepositoryPort,
} from "../../ports/push-delivery-outbox.repository.port";
import { PublishPushDeliveryOutboxUseCase } from "../publish-push-delivery-outbox/publish-push-delivery-outbox.use-case";

const RELAY_BATCH_SIZE = 100;
const MAX_BATCHES_PER_TRIGGER = 10;
// Expo SDK 6.x 전송은 AbortSignal timeout을 제공하지 않는다. 정상적인 외부 요청을
// queue job 만료(5분) 전에 회수하지 않도록 lease를 그보다 넉넉하게 유지한다.
const PROCESSING_LEASE_MS = 15 * 60_000;

@Injectable()
export class RelayPushDeliveryOutboxUseCase {
	constructor(
		@Inject(PUSH_DELIVERY_OUTBOX_REPOSITORY)
		private readonly outbox: PushDeliveryOutboxRepositoryPort,
		@Inject(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
		private readonly lifecycle: PushDeliveryLifecycleRepositoryPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
		private readonly publishOutbox: PublishPushDeliveryOutboxUseCase,
	) {}

	async execute(): Promise<void> {
		const now = Date.now();
		const processingCutoff = new Date(now - PROCESSING_LEASE_MS);
		await this.uow.run(async () => {
			await this.lifecycle.recoverStaleProcessing(processingCutoff);
			await this.outbox.recoverStaleProcessing(processingCutoff);
		});

		for (let batch = 0; batch < MAX_BATCHES_PER_TRIGGER; batch += 1) {
			const published = await this.publishOutbox.execute({
				kind: "available",
				limit: RELAY_BATCH_SIZE,
			});
			if (published < RELAY_BATCH_SIZE) return;
		}
	}
}
