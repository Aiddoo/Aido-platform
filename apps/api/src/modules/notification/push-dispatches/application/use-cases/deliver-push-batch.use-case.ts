import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { NotificationId } from "../../../notifications/domain/notification-id.vo.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import type {
  PushDeliveryEligibilityDecision,
  PushDeliverySettingsDecision,
} from "../../domain/push-delivery-decision.domain-service.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import type { PushSendResult } from "../ports/push-channel.port.js";
import type { ClaimedPushDelivery } from "../ports/push-delivery-claim.repository.port.js";
import type {
  PushDeliveryContext,
  PushDeliveryFinalizationRepositoryPort,
} from "../ports/push-delivery-finalization.repository.port.js";
import type { PushNotificationPayloadPort } from "../ports/push-notification-payload.port.js";
import { pushDeliveryRecipientMissing } from "../push-dispatches.errors.js";
import type { EvaluateBatchPushDeliverySettingsUseCase } from "./evaluate-batch-push-delivery-settings.use-case.js";
import type { FinalizeSkippedPushDeliveriesUseCase } from "./finalize-skipped-push-deliveries.use-case.js";
import type {
  BatchPushDeliveryRecipient,
  LoadPushDeliveryRecipientsUseCase,
} from "./load-push-delivery-recipients.use-case.js";
import type { MarkPushRateLimitReservedUseCase } from "./mark-push-rate-limit-reserved.use-case.js";
import type { PreparePushBatchUseCase } from "./prepare-push-batch.use-case.js";
import type { ReserveBatchPushRateLimitsUseCase } from "./reserve-batch-push-rate-limits.use-case.js";
import type { SendPushBatchUseCase } from "./send-push-batch.use-case.js";

interface ClaimedBatchCandidate {
  readonly claimed: ClaimedPushDelivery;
  readonly dispatchId: number;
  readonly data: CreateNotificationData;
  readonly rateLimitDispatchId: number;
}

// 설정 판단을 통과해 받는 사람 기준 보관 시간이 정해진 후보다
interface ExpiringBatchCandidate extends ClaimedBatchCandidate {
  readonly ttlSeconds: number;
}

interface SkippedCandidate<TCandidate> {
  readonly candidate: TCandidate;
  readonly reason: PushDispatchSkipReason;
}

interface PartitionedEligibility<TCandidate, TEligible = TCandidate> {
  readonly eligible: TEligible[];
  readonly skipped: SkippedCandidate<TCandidate>[];
}

interface DeliverPushBatchDependencies {
  readonly loadRecipients: Pick<LoadPushDeliveryRecipientsUseCase, "execute">;
  readonly evaluateSettings: Pick<EvaluateBatchPushDeliverySettingsUseCase, "execute">;
  readonly reserveRateLimits: Pick<ReserveBatchPushRateLimitsUseCase, "execute">;
  readonly markRateLimitReserved: Pick<MarkPushRateLimitReservedUseCase, "execute">;
  readonly payloadFactory: Pick<PushNotificationPayloadPort, "createBatch">;
  readonly preparePushBatch: Pick<PreparePushBatchUseCase, "execute">;
  readonly sendPushBatch: Pick<SendPushBatchUseCase, "execute">;
  readonly finalizeSkipped: Pick<FinalizeSkippedPushDeliveriesUseCase, "execute">;
  readonly finalization: Pick<PushDeliveryFinalizationRepositoryPort, "finalizeResults">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

// 담당한 배치 발송을 설정·빈도 제한으로 거르고 한 번에 보낸 뒤 담당 fence로 끝낸다
export class DeliverPushBatchUseCase {
  readonly #dependencies: DeliverPushBatchDependencies;

  constructor(dependencies: DeliverPushBatchDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(claimed: readonly ClaimedPushDelivery[]): Promise<void> {
    if (claimed.length === 0) {
      return;
    }
    const candidates = claimed.map<ClaimedBatchCandidate>((item) => ({
      claimed: item,
      dispatchId: item.fence.dispatchId,
      data: item.item.data,
      rateLimitDispatchId: item.fence.dispatchId,
    }));
    const recipients = await this.#dependencies.loadRecipients.execute(
      candidates.map((candidate) => candidate.data.userId),
    );
    const contexts = batchContexts(candidates, recipients);
    const settings = partitionSettings(
      this.#dependencies.evaluateSettings.execute({ candidates, recipients }),
    );
    await this.#finalizeSkipped(settings.skipped, contexts);

    const eligible = await this.#reserveRateLimits(settings.eligible, recipients, contexts);
    if (eligible.length === 0) {
      return;
    }
    await this.#send(eligible, recipients, contexts);
  }

  // 이미 예약한 후보와 새로 예약한 후보만 보낸다
  async #reserveRateLimits(
    candidates: readonly ExpiringBatchCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
    contexts: ReadonlyMap<number, PushDeliveryContext>,
  ): Promise<ExpiringBatchCandidate[]> {
    const reserved = candidates.filter(
      (candidate) => candidate.claimed.rateLimitReservation.status === "reserved",
    );
    const pendingReservation = candidates.filter(
      (candidate) => candidate.claimed.rateLimitReservation.status === "pending",
    );
    const rateLimit = partitionEligibility(
      await this.#dependencies.reserveRateLimits.execute({
        candidates: pendingReservation,
        recipients,
      }),
    );
    await this.#finalizeSkipped(rateLimit.skipped, contexts);
    const newlyReserved = await this.#dependencies.markRateLimitReserved.execute(
      rateLimit.eligible.map((candidate) => candidate.claimed),
    );
    const approvedDispatchIds = new Set([
      ...reserved.map((candidate) => candidate.dispatchId),
      ...newlyReserved,
    ]);
    return candidates.filter((candidate) => approvedDispatchIds.has(candidate.dispatchId));
  }

  async #send(
    eligible: readonly ExpiringBatchCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
    contexts: ReadonlyMap<number, PushDeliveryContext>,
  ): Promise<void> {
    const prepared = await this.#dependencies.preparePushBatch.execute(
      eligible.map((candidate) =>
        this.#dependencies.payloadFactory.createBatch({
          data: candidate.data,
          notificationId: NotificationId.reconstitute(candidate.claimed.item.notificationId),
          dispatchId: PushDispatchId.reconstitute(candidate.dispatchId),
          locale: resolveRecipientLocale({
            storedLocale: recipients.get(candidate.data.userId)?.preference?.locale ?? null,
            lastRequestLocale: null,
          }),
          ttlSeconds: candidate.ttlSeconds,
        }),
      ),
    );
    const candidateByDispatchId = new Map(
      eligible.map((candidate) => [candidate.dispatchId, candidate]),
    );
    await this.#finalizeSkipped(
      prepared.skippedDispatches.flatMap((skipped) => {
        const candidate = candidateByDispatchId.get(skipped.dispatchId);
        return candidate ? [{ candidate, reason: skipped.reason }] : [];
      }),
      contexts,
    );

    const result =
      prepared.status === "ready"
        ? await this.#dependencies.sendPushBatch.execute(prepared)
        : {
            attemptedDispatchIds: prepared.attemptedDispatchIds,
            resultsByDispatch: new Map<number, PushSendResult[]>(),
          };
    const finalizations = [...result.attemptedDispatchIds].flatMap((dispatchId) => {
      const candidate = candidateByDispatchId.get(dispatchId);
      const context = contexts.get(dispatchId);
      return candidate && context
        ? [
            {
              fence: candidate.claimed.fence,
              context,
              results: result.resultsByDispatch.get(dispatchId) ?? [],
            },
          ]
        : [];
    });
    await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.finalization.finalizeResults(finalizations),
    );
  }

  async #finalizeSkipped(
    skipped: readonly SkippedCandidate<ClaimedBatchCandidate>[],
    contexts: ReadonlyMap<number, PushDeliveryContext>,
  ): Promise<void> {
    await this.#dependencies.finalizeSkipped.execute(
      skipped.flatMap(({ candidate, reason }) => {
        const context = contexts.get(candidate.dispatchId);
        return context == null ? [] : [{ claimed: candidate.claimed, context, reason }];
      }),
    );
  }
}

function batchContexts(
  candidates: readonly ClaimedBatchCandidate[],
  recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
): ReadonlyMap<number, PushDeliveryContext> {
  const contexts = new Map<number, PushDeliveryContext>();
  for (const candidate of candidates) {
    const recipient = recipients.get(candidate.data.userId);
    if (!recipient) {
      throw pushDeliveryRecipientMissing(candidate.data.userId);
    }
    contexts.set(candidate.dispatchId, {
      timezone: recipient.timezone,
      localDate: Temporal.PlainDate.from(recipient.localDate),
    });
  }
  return contexts;
}

function partitionSettings(
  decisions: readonly PushDeliverySettingsDecision<ClaimedBatchCandidate>[],
): PartitionedEligibility<ClaimedBatchCandidate, ExpiringBatchCandidate> {
  const eligible: ExpiringBatchCandidate[] = [];
  const skipped: SkippedCandidate<ClaimedBatchCandidate>[] = [];
  for (const decision of decisions) {
    if (decision.status === "eligible") {
      eligible.push({ ...decision.candidate, ttlSeconds: decision.ttlSeconds });
    } else {
      skipped.push({ candidate: decision.candidate, reason: decision.reason });
    }
  }
  return { eligible, skipped };
}

function partitionEligibility<TCandidate>(
  decisions: readonly PushDeliveryEligibilityDecision<TCandidate>[],
): PartitionedEligibility<TCandidate> {
  const eligible: TCandidate[] = [];
  const skipped: SkippedCandidate<TCandidate>[] = [];
  for (const decision of decisions) {
    if (decision.status === "eligible") {
      eligible.push(decision.candidate);
    } else {
      skipped.push({ candidate: decision.candidate, reason: decision.reason });
    }
  }
  return { eligible, skipped };
}
