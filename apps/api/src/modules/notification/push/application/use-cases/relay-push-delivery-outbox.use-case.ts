import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { type PushDeliveryLifecycleRepositoryPort } from "../ports/push-delivery-lifecycle.repository.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../ports/push-delivery-outbox.repository.port.js";
import type { PushProviderPort, PushProviderTiming } from "../ports/push-provider.port.js";
import { PUSH_DELIVERY_JOB_EXPIRE_SECONDS } from "../read-models/push-delivery.read-model.js";
import type { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case.js";

const RELAY_BATCH_SIZE = 100;
const MAX_BATCHES_PER_TRIGGER = 10;

// lease가 작업 만료보다 짧으면 아직 실행 중인 작업의 dispatch를 되돌려 두 번 보낸다.
// 공급자 전송은 끊기지 않아 만료 뒤에도 이어질 수 있으므로 그 여유를 더한다
function processingLeaseMs(timing: PushProviderTiming): number {
  return PUSH_DELIVERY_JOB_EXPIRE_SECONDS * 1000 + timing.unabortableSendGraceMs;
}

interface RelayPushDeliveryOutboxDependencies {
  readonly outbox: Pick<PushDeliveryOutboxRepositoryPort, "recoverStaleProcessing">;
  readonly lifecycle: Pick<PushDeliveryLifecycleRepositoryPort, "recoverStaleProcessing">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly publishOutbox: Pick<PublishPushDeliveryOutboxUseCase, "execute">;
  readonly pushProvider: Pick<PushProviderPort, "timing">;
  readonly clock: ClockPort;
}

export class RelayPushDeliveryOutboxUseCase {
  readonly #dependencies: RelayPushDeliveryOutboxDependencies;

  constructor(dependencies: RelayPushDeliveryOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const processingCutoff = this.#dependencies.clock
      .now()
      .subtract({ milliseconds: processingLeaseMs(this.#dependencies.pushProvider.timing) });
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.lifecycle.recoverStaleProcessing(processingCutoff);
      await this.#dependencies.outbox.recoverStaleProcessing(processingCutoff);
    });

    for (let batch = 0; batch < MAX_BATCHES_PER_TRIGGER; batch += 1) {
      const published = await this.#dependencies.publishOutbox.execute({
        kind: "available",
        limit: RELAY_BATCH_SIZE,
      });
      if (published < RELAY_BATCH_SIZE) {
        return;
      }
    }
  }
}
