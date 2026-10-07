import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type AfterCommitTaskRegistryPort } from "#api/shared/application/ports/index";
import { withTimeout } from "#api/shared/application/utils/with-timeout.util";

import type { PublishPushDeliveryOutbox } from "../../use-cases/delivery/publish-push-delivery-outbox.use-case.js";

const FAST_PATH_TIMEOUT_MS = 2_000;

/** 커밋된 dispatch ID만 캡처해 durable outbox 발행 fast path를 등록한다. */
interface PushDeliveryAfterCommitPublisherDependencies {
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly publishOutbox: PublishPushDeliveryOutbox;
  readonly logger: ApplicationLogger;
}

export class PushDeliveryAfterCommitPublisher {
  readonly #dependencies: PushDeliveryAfterCommitPublisherDependencies;

  constructor(dependencies: PushDeliveryAfterCommitPublisherDependencies) {
    this.#dependencies = dependencies;
  }

  register(dispatchIds: readonly number[]): void {
    if (dispatchIds.length === 0) return;
    const committedDispatchIds = [...dispatchIds];
    this.#dependencies.afterCommit.register(async () => {
      try {
        await withTimeout(
          this.#dependencies.publishOutbox.execute({
            kind: "dispatches",
            dispatchIds: committedDispatchIds,
          }),
          FAST_PATH_TIMEOUT_MS,
          "Push delivery after-commit publication",
        );
      } catch (error) {
        // Timeout은 underlying publish를 취소하지 않는다. PENDING/PROCESSING은 relay가 복구한다.
        this.#dependencies.logger.warn(`Push delivery fast path did not settle in time: ${error}`);
      }
    });
  }
}
