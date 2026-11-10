import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { type PushDeliveryLifecycleRepositoryPort } from "../ports/push-delivery-lifecycle.repository.port.js";
import type { PushDeliveryPublication } from "../read-models/push-delivery.read-model.js";

interface RecoverFailedPushDeliveriesInput {
  readonly publications: readonly PushDeliveryPublication[];
}

/**
 * Runtime retry가 모두 소진된 delivery publication을 DB 회복 뒤 다시 relay 가능하게 만든다.
 *
 * 이미 reopen된 row, terminal dispatch, newer generation, 실행 중 lease는 의도적인 no-op이다.
 */
interface RecoverFailedPushDeliveriesDependencies {
  readonly lifecycle: Pick<PushDeliveryLifecycleRepositoryPort, "reopenFailedPublications">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

export class RecoverFailedPushDeliveriesUseCase {
  readonly #dependencies: RecoverFailedPushDeliveriesDependencies;

  constructor(dependencies: RecoverFailedPushDeliveriesDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: RecoverFailedPushDeliveriesInput): Promise<number> {
    return this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.lifecycle.reopenFailedPublications({
        publications: input.publications,
        availableAt: now(),
        error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
      }),
    );
  }
}
