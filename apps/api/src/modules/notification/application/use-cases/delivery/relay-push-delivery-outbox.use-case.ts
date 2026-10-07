import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { type PushDeliveryLifecycleRepositoryPort } from "../../ports/delivery/push-delivery-lifecycle.repository.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../../ports/delivery/push-delivery-outbox.repository.port.js";
import type { PublishPushDeliveryOutbox } from "./publish-push-delivery-outbox.use-case.js";

const RELAY_BATCH_SIZE = 100;
const MAX_BATCHES_PER_TRIGGER = 10;
// Expo SDK 6.x 전송은 AbortSignal timeout을 제공하지 않는다. 정상적인 외부 요청을
// queue job 만료(5분) 전에 회수하지 않도록 lease를 그보다 넉넉하게 유지한다.
const PROCESSING_LEASE_MS = 15 * 60_000;

interface RelayPushDeliveryOutboxDependencies {
  readonly outbox: PushDeliveryOutboxRepositoryPort;
  readonly lifecycle: PushDeliveryLifecycleRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly publishOutbox: PublishPushDeliveryOutbox;
}

export class RelayPushDeliveryOutbox {
  readonly #dependencies: RelayPushDeliveryOutboxDependencies;

  constructor(dependencies: RelayPushDeliveryOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const now = Date.now();
    const processingCutoff = new Date(now - PROCESSING_LEASE_MS);
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.lifecycle.recoverStaleProcessing(processingCutoff);
      await this.#dependencies.outbox.recoverStaleProcessing(processingCutoff);
    });

    for (let batch = 0; batch < MAX_BATCHES_PER_TRIGGER; batch += 1) {
      const published = await this.#dependencies.publishOutbox.execute({
        kind: "available",
        limit: RELAY_BATCH_SIZE,
      });
      if (published < RELAY_BATCH_SIZE) return;
    }
  }
}
