import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn, resolveDeliveryTimezone } from "#api/shared/domain/time/timezone-name";

import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import {
  type PushDeliveryEligibilityDecision,
  skippedPushDelivery,
} from "../../domain/push-delivery-decision.domain-service.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import {
  isAutomatedEngagementNotification,
  isGeneralRateLimitExemptNotification,
} from "../../domain/push-eligibility.domain-service.js";
import type { PushRateLimiterPort, PushRateLimitRequest } from "../ports/push-rate-limiter.port.js";
import type { BatchPushDeliveryRecipient } from "./load-push-delivery-recipients.use-case.js";

export interface PushDeliveryCandidate {
  readonly data: CreateNotificationData;
  readonly rateLimitDispatchId: number;
}

export interface ReserveBatchPushRateLimitsCommand<TCandidate> {
  readonly candidates: readonly TCandidate[];
  readonly recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>;
}

interface ReserveBatchPushRateLimitsDependencies {
  readonly rateLimiter: Pick<PushRateLimiterPort, "reserveBatch">;
  readonly clock: ClockPort;
}

// 배치 푸시의 일반·참여 유도 빈도 제한을 한 번에 예약하고 넘은 후보를 건너뛴다
export class ReserveBatchPushRateLimitsUseCase {
  readonly #dependencies: ReserveBatchPushRateLimitsDependencies;

  constructor(dependencies: ReserveBatchPushRateLimitsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute<TCandidate extends PushDeliveryCandidate>(
    command: ReserveBatchPushRateLimitsCommand<TCandidate>,
  ): Promise<readonly PushDeliveryEligibilityDecision<TCandidate>[]> {
    const { candidates, recipients } = command;
    const reservable = candidates.filter(
      (candidate) => !isGeneralRateLimitExemptNotification(candidate.data.type),
    );
    const limited = await this.#dependencies.rateLimiter.reserveBatch(
      reservable.map((candidate) =>
        this.#createRateLimitRequest(candidate, recipients.get(candidate.data.userId)),
      ),
    );
    const limitedCandidates = new Set(reservable.filter((_, index) => limited[index]));

    return candidates.map((candidate) =>
      limitedCandidates.has(candidate)
        ? skippedPushDelivery(candidate, "RATE_LIMITED")
        : { status: "eligible", candidate },
    );
  }

  #createRateLimitRequest(
    candidate: PushDeliveryCandidate,
    recipient: BatchPushDeliveryRecipient | undefined,
  ): PushRateLimitRequest {
    const { data } = candidate;
    const isEngagement =
      data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
    return {
      dispatchId: PushDispatchId.reconstitute(candidate.rateLimitDispatchId),
      userId: UserId.reconstitute(data.userId),
      ...(isEngagement && {
        engagementLocalDate:
          recipient?.localDate ??
          localDateIn(
            this.#dependencies.clock.now(),
            resolveDeliveryTimezone(recipient?.preference?.timezone),
          ).toString(),
      }),
    };
  }
}
