import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import type { ClaimedPushDelivery } from "../ports/push-delivery-claim.repository.port.js";
import type { PushDeliveryFinalizationRepositoryPort } from "../ports/push-delivery-finalization.repository.port.js";
import type { PushNotificationPayloadPort } from "../ports/push-notification-payload.port.js";
import type { DispatchPushNotificationUseCase } from "./dispatch-push-notification.use-case.js";
import type { EvaluatePushDeliveryEligibilityUseCase } from "./evaluate-push-delivery-eligibility.use-case.js";
import type { FinalizeSkippedPushDeliveriesUseCase } from "./finalize-skipped-push-deliveries.use-case.js";
import type { LoadPushDeliveryRecipientUseCase } from "./load-push-delivery-recipient.use-case.js";
import type { MarkPushRateLimitReservedUseCase } from "./mark-push-rate-limit-reserved.use-case.js";

interface DeliverSinglePushDependencies {
  readonly loadRecipient: Pick<LoadPushDeliveryRecipientUseCase, "execute">;
  readonly evaluateEligibility: Pick<EvaluatePushDeliveryEligibilityUseCase, "execute">;
  readonly markRateLimitReserved: Pick<MarkPushRateLimitReservedUseCase, "execute">;
  readonly payloadFactory: Pick<PushNotificationPayloadPort, "createSingle">;
  readonly dispatchPush: Pick<DispatchPushNotificationUseCase, "execute">;
  readonly finalizeSkipped: Pick<FinalizeSkippedPushDeliveriesUseCase, "execute">;
  readonly finalization: Pick<PushDeliveryFinalizationRepositoryPort, "finalizeResults">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

// 담당한 단건 발송을 받는 사람 설정으로 판단해 보내고 담당 fence로 끝낸다
export class DeliverSinglePushUseCase {
  readonly #dependencies: DeliverSinglePushDependencies;

  constructor(dependencies: DeliverSinglePushDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(claimed: ClaimedPushDelivery): Promise<void> {
    const { data } = claimed.item;
    const recipient = await this.#dependencies.loadRecipient.execute(data.userId);
    const context = {
      timezone: recipient.timezone,
      localDate: Temporal.PlainDate.from(recipient.localDate),
    };
    const eligibility = await this.#dependencies.evaluateEligibility.execute({
      data,
      recipient,
      rateLimitDispatchId: claimed.fence.dispatchId,
      hasReservedRateLimit: claimed.rateLimitReservation.status === "reserved",
    });
    if (eligibility.status === "skipped") {
      await this.#dependencies.finalizeSkipped.execute([
        { claimed, context, reason: eligibility.reason },
      ]);
      return;
    }
    if (claimed.rateLimitReservation.status === "pending") {
      await this.#dependencies.markRateLimitReserved.execute([claimed]);
    }

    const delivery = await this.#dependencies.dispatchPush.execute({
      data,
      payload: this.#dependencies.payloadFactory.createSingle({
        data,
        notificationId: NotificationId.reconstitute(claimed.item.notificationId),
        dispatchId: PushDispatchId.reconstitute(claimed.fence.dispatchId),
        locale: resolveRecipientLocale({
          storedLocale: recipient.preference.locale,
          lastRequestLocale: null,
        }),
        ttlSeconds: eligibility.ttlSeconds,
      }),
    });
    if (delivery.status === "skipped") {
      await this.#dependencies.finalizeSkipped.execute([
        { claimed, context, reason: delivery.reason },
      ]);
      return;
    }

    await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.finalization.finalizeResults([
        { fence: claimed.fence, context, results: delivery.results },
      ]),
    );
  }
}
