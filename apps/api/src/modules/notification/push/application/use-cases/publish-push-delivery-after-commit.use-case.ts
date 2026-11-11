import { withTimeout } from "es-toolkit";

import { type AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case.js";

const FAST_PATH_TIMEOUT_MS = 2000;

/** 커밋된 dispatch ID만 캡처해 durable outbox 발행 fast path를 등록한다. */
interface PushDeliveryAfterCommitPublisherDependencies {
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly publishOutbox: Pick<PublishPushDeliveryOutboxUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class PublishPushDeliveryAfterCommitUseCase {
  readonly #dependencies: PushDeliveryAfterCommitPublisherDependencies;

  constructor(dependencies: PushDeliveryAfterCommitPublisherDependencies) {
    this.#dependencies = dependencies;
  }

  register(dispatchIds: readonly number[]): void {
    if (dispatchIds.length === 0) {
      return;
    }
    const committedDispatchIds = [...dispatchIds];
    this.#dependencies.afterCommit.register(async () => {
      try {
        await withTimeout(
          () =>
            this.#dependencies.publishOutbox.execute({
              kind: "dispatches",
              dispatchIds: committedDispatchIds,
            }),
          FAST_PATH_TIMEOUT_MS,
        );
      } catch {
        // Timeout은 underlying publish를 취소하지 않는다. PENDING/PROCESSING은 relay가 복구한다.
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.PUSH_DELIVERY_AFTER_COMMIT_FAST_PATH_UNSETTLED,
          dispatchCount: committedDispatchIds.length,
          errorType: "publication-unsettled",
        });
      }
    });
  }
}
