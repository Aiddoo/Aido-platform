import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { pushDeliveryOutboxRetryDelayMs } from "../../policies/delivery/push-delivery-outbox-retry.policy.js";
import { type PushDeliveryJobEnqueuerPort } from "../../ports/delivery/push-delivery-job-enqueuer.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../../ports/delivery/push-delivery-outbox.repository.port.js";
import type { PushDeliveryPublication } from "../../types/delivery/push-delivery.types.js";

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

interface PublishPushDeliveryOutboxDependencies {
  readonly outbox: PushDeliveryOutboxRepositoryPort;
  readonly enqueuer: PushDeliveryJobEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class PublishPushDeliveryOutbox {
  readonly #dependencies: PublishPushDeliveryOutboxDependencies;

  constructor(dependencies: PublishPushDeliveryOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: PublishPushDeliveryOutboxInput): Promise<number> {
    if (input.kind === "available") {
      const claimed = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.claimAvailable({
          limit: Math.min(input.limit, DELIVERY_JOB_BATCH_SIZE),
          lockedAt: new Date(),
        }),
      );
      return this.#publish(claimed);
    }

    let publishedCount = 0;
    for (let offset = 0; offset < input.dispatchIds.length; offset += DELIVERY_JOB_BATCH_SIZE) {
      const dispatchIds = input.dispatchIds.slice(offset, offset + DELIVERY_JOB_BATCH_SIZE);
      const claimed = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.claimByDispatchIds(dispatchIds, new Date()),
      );
      publishedCount += await this.#publish(claimed);
    }
    return publishedCount;
  }

  async #publish(publications: readonly PushDeliveryPublication[]): Promise<number> {
    if (publications.length === 0) return 0;
    try {
      // JobRuntime의 null(동일 idempotency key)은 이미 발행된 동일 generation으로 성공이다.
      await this.#dependencies.enqueuer.enqueueDeliveries(publications);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const highestAttempt = Math.max(...publications.map((item) => item.publishAttempt));
      await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.defer({
          publications,
          availableAt: new Date(Date.now() + pushDeliveryOutboxRetryDelayMs(highestAttempt)),
          error: message,
        }),
      );
      this.#dependencies.logger.warn(
        `Push delivery enqueue deferred: dispatchIds=${publications.map((item) => item.dispatchId).join(",")}, error=${message}`,
      );
      return 0;
    }

    try {
      return await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.markPublished(publications, new Date()),
      );
    } catch (error) {
      // enqueue 성공 여부가 확정된 뒤에는 generation을 되돌리지 않는다.
      // PROCESSING lease recovery가 같은 generation 또는 새 generation으로 안전하게 복구한다.
      this.#dependencies.logger.warn(
        `Push delivery outbox publish mark failed: dispatchIds=${publications.map((item) => item.dispatchId).join(",")}, error=${error}`,
      );
      return 0;
    }
  }
}
