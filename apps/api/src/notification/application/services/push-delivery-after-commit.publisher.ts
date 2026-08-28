import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTaskRegistryPort,
} from "@/shared/application/ports";
import { withTimeout } from "@/shared/application/utils/with-timeout.util";

import { PublishPushDeliveryOutboxUseCase } from "../use-cases/publish-push-delivery-outbox/publish-push-delivery-outbox.use-case";

const FAST_PATH_TIMEOUT_MS = 2_000;

/** 커밋된 dispatch ID만 캡처해 durable outbox 발행 fast path를 등록한다. */
@Injectable()
export class PushDeliveryAfterCommitPublisher {
	readonly #logger = new Logger(PushDeliveryAfterCommitPublisher.name);

	constructor(
		@Inject(AFTER_COMMIT_TASK_REGISTRY)
		private readonly afterCommit: AfterCommitTaskRegistryPort,
		private readonly publishOutbox: PublishPushDeliveryOutboxUseCase,
	) {}

	register(dispatchIds: readonly number[]): void {
		if (dispatchIds.length === 0) return;
		const committedDispatchIds = [...dispatchIds];
		this.afterCommit.register(async () => {
			try {
				await withTimeout(
					this.publishOutbox.execute({
						kind: "dispatches",
						dispatchIds: committedDispatchIds,
					}),
					FAST_PATH_TIMEOUT_MS,
					"Push delivery after-commit publication",
				);
			} catch (error) {
				// Timeout은 underlying publish를 취소하지 않는다. PENDING/PROCESSING은 relay가 복구한다.
				this.#logger.warn(`Push delivery fast path did not settle in time: ${error}`);
			}
		});
	}
}
