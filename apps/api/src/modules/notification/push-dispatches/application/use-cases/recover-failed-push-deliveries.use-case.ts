import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { type PushDeliveryLifecycleRepositoryPort } from "../ports/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryPublication } from "../read-models/push-delivery.read-model.js";

interface RecoverFailedPushDeliveriesInput {
  readonly publications: readonly PushDeliveryPublication[];
}

interface RecoverFailedPushDeliveriesDependencies {
  readonly lifecycle: Pick<PushDeliveryLifecycleRepositoryPort, "reopenFailedPublications">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
}

// runtime 재시도가 모두 끝난 publication을 다시 relay할 수 있게 연다. 이미 다시 연 행·종결 dispatch·새 generation·실행 중 lease는 일부러 건너뛴다

export class RecoverFailedPushDeliveriesUseCase {
  readonly #dependencies: RecoverFailedPushDeliveriesDependencies;

  constructor(dependencies: RecoverFailedPushDeliveriesDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: RecoverFailedPushDeliveriesInput): Promise<number> {
    return this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.lifecycle.reopenFailedPublications({
        publications: input.publications,
        availableAt: this.#dependencies.clock.now(),
        error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
      }),
    );
  }
}
