import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port";
import type { PushDeliveryPublication } from "../../types/push-delivery.types";

interface RecoverFailedPushDeliveriesInput {
	readonly publications: readonly PushDeliveryPublication[];
}

/**
 * Runtime retry가 모두 소진된 delivery publication을 DB 회복 뒤 다시 relay 가능하게 만든다.
 *
 * 이미 reopen된 row, terminal dispatch, newer generation, 실행 중 lease는 의도적인 no-op이다.
 */
@Injectable()
export class RecoverFailedPushDeliveriesUseCase {
	constructor(
		@Inject(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
		private readonly lifecycle: PushDeliveryLifecycleRepositoryPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	execute(input: RecoverFailedPushDeliveriesInput): Promise<number> {
		return this.uow.run(() =>
			this.lifecycle.reopenFailedPublications({
				publications: input.publications,
				availableAt: new Date(),
				error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
			}),
		);
	}
}
