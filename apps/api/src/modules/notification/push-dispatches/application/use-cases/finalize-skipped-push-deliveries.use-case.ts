import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { ClaimedPushDelivery } from "../ports/push-delivery-claim.repository.port.js";
import type {
  PushDeliveryContext,
  PushDeliveryFinalizationRepositoryPort,
} from "../ports/push-delivery-finalization.repository.port.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";

export interface SkippedPushDelivery {
  readonly claimed: ClaimedPushDelivery;
  readonly context: PushDeliveryContext;
  readonly reason: PushDispatchSkipReason;
}

interface FinalizeSkippedPushDeliveriesDependencies {
  readonly finalization: Pick<PushDeliveryFinalizationRepositoryPort, "finalizeSkipped">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

// 보내지 않기로 한 발송을 이유와 함께 담당 fence로 끝낸다
export class FinalizeSkippedPushDeliveriesUseCase {
  readonly #dependencies: FinalizeSkippedPushDeliveriesDependencies;

  constructor(dependencies: FinalizeSkippedPushDeliveriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(skipped: readonly SkippedPushDelivery[]): Promise<void> {
    for (const { claimed, reason } of skipped) {
      this.#dependencies.logger.debug({
        event: PushDispatchLogEvent.DELIVER_PUSH_NOTIFICATIONS_DISPATCH_SKIPPED,
        userId: claimed.item.data.userId,
        type: claimed.item.data.type,
        reason,
      });
    }
    await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.finalization.finalizeSkipped(
        skipped.map(({ claimed, context, reason }) => ({ fence: claimed.fence, context, reason })),
      ),
    );
  }
}
