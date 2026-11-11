import { chunk, groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import {
  PUSH_DELIVERY_LANES,
  type PushDeliveryLane,
} from "../../domain/push-delivery-lane.domain-service.js";
import { pushDeliveryOutboxRetryDelayMs } from "../../domain/push-delivery-outbox-retry.domain-service.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type PushDeliveryJobEnqueuerPort } from "../ports/push-delivery-job-enqueuer.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../ports/push-delivery-outbox.repository.port.js";
import {
  type ClaimedPushDeliveryPublication,
  PUSH_DELIVERY_JOB_MAX_PUBLICATIONS,
  type PushDeliveryPublication,
} from "../read-models/push-delivery.read-model.js";

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
  readonly outbox: Pick<
    PushDeliveryOutboxRepositoryPort,
    "claimAvailable" | "claimByDispatchIds" | "defer" | "markPublished"
  >;
  readonly enqueuer: Pick<PushDeliveryJobEnqueuerPort, "enqueueDeliveries">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class PublishPushDeliveryOutboxUseCase {
  readonly #dependencies: PublishPushDeliveryOutboxDependencies;

  constructor(dependencies: PublishPushDeliveryOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: PublishPushDeliveryOutboxInput): Promise<number> {
    if (input.kind === "available") {
      const claimed = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.claimAvailable({
          limit: Math.min(input.limit, PUSH_DELIVERY_JOB_MAX_PUBLICATIONS),
          lockedAt: this.#now(),
        }),
      );
      return this.#publish(claimed);
    }

    let publishedCount = 0;
    for (const dispatchIds of chunk(input.dispatchIds, PUSH_DELIVERY_JOB_MAX_PUBLICATIONS)) {
      const claimed = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.claimByDispatchIds(dispatchIds, this.#now()),
      );
      publishedCount += await this.#publish(claimed);
    }
    return publishedCount;
  }

  async #publish(claimed: readonly ClaimedPushDeliveryPublication[]): Promise<number> {
    // 한 작업에 차선을 섞지 않아야 거래성 전용 worker가 마케팅 작업을 집어 가지 않는다
    const byLane = groupBy(claimed, (publication) => publication.lane);
    let publishedCount = 0;
    for (const lane of PUSH_DELIVERY_LANES) {
      const publications = (byLane[lane] ?? []).map(({ dispatchId, publishAttempt }) => ({
        dispatchId,
        publishAttempt,
      }));
      publishedCount += await this.#publishLane(publications, lane);
    }
    return publishedCount;
  }

  async #publishLane(
    publications: readonly PushDeliveryPublication[],
    lane: PushDeliveryLane,
  ): Promise<number> {
    if (publications.length === 0) {
      return 0;
    }
    try {
      // 큐의 null(동일 idempotency key)은 이미 발행된 동일 generation으로 성공이다.
      await this.#dependencies.enqueuer.enqueueDeliveries(publications, lane);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const highestAttempt = Math.max(...publications.map((item) => item.publishAttempt));
      await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.defer({
          publications,
          availableAt: this.#now().add({
            milliseconds: pushDeliveryOutboxRetryDelayMs(highestAttempt),
          }),
          error: message,
        }),
      );
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.PUBLISH_PUSH_DELIVERY_OUTBOX_ENQUEUE_DEFERRED,
        dispatchCount: publications.length,
        errorType: "enqueue",
      });
      return 0;
    }

    try {
      return await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.outbox.markPublished(publications, this.#now()),
      );
    } catch {
      // enqueue 성공 여부가 확정된 뒤에는 generation을 되돌리지 않는다.
      // PROCESSING lease recovery가 같은 generation 또는 새 generation으로 안전하게 복구한다.
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.PUBLISH_PUSH_DELIVERY_OUTBOX_PUBLISH_MARK_FAILED,
        dispatchCount: publications.length,
        errorType: "publication-state",
      });
      return 0;
    }
  }

  #now(): Temporal.Instant {
    return this.#dependencies.clock.now();
  }
}
