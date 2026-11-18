import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserNotificationSettingsPort } from "../../../shared/application/ports/user-notification-settings.port.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import {
  decidePushExpiry,
  isMarketingDelivery,
  mustExpireBeforeQuietHours,
  type PushDeliverySettingsDecision,
  skippedPushDelivery,
} from "../../domain/push-delivery-decision.domain-service.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import {
  isAiPushDisabled,
  isAutomatedEngagementNotification,
  isGeneralRateLimitExemptNotification,
} from "../../domain/push-eligibility.domain-service.js";
import type { PushRateLimiterPort } from "../ports/push-rate-limiter.port.js";
import type { SinglePushDeliveryRecipient } from "./load-push-delivery-recipient.use-case.js";

export interface EvaluatePushDeliveryEligibilityCommand {
  readonly data: CreateNotificationData;
  readonly recipient: SinglePushDeliveryRecipient;
  readonly rateLimitDispatchId: number;
  readonly hasReservedRateLimit: boolean;
}

interface EvaluatePushDeliveryEligibilityDependencies {
  readonly userSettings: Pick<UserNotificationSettingsPort, "findConsentReadModel">;
  readonly rateLimiter: Pick<PushRateLimiterPort, "reserveEngagement" | "reserveGeneral">;
  readonly clock: ClockPort;
}

// 단건 푸시의 수신 설정·동의·야간 시간·빈도 제한을 판단한다
export class EvaluatePushDeliveryEligibilityUseCase {
  readonly #dependencies: EvaluatePushDeliveryEligibilityDependencies;

  constructor(dependencies: EvaluatePushDeliveryEligibilityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: EvaluatePushDeliveryEligibilityCommand,
  ): Promise<PushDeliverySettingsDecision<CreateNotificationData>> {
    const { data, recipient, rateLimitDispatchId, hasReservedRateLimit } = command;
    const { preference } = recipient;
    if (!preference.pushEnabled) {
      return skippedPushDelivery(data, "PUSH_DISABLED");
    }
    if (isAiPushDisabled(data.type, preference)) {
      return skippedPushDelivery(data, "AI_PUSH_DISABLED");
    }

    // 단건 경로는 기존 계약대로 일반 rate counter를 설정·야간·동의보다 먼저 예약한다.
    if (
      !hasReservedRateLimit &&
      !isGeneralRateLimitExemptNotification(data.type) &&
      (await this.#dependencies.rateLimiter.reserveGeneral({
        dispatchId: PushDispatchId.reconstitute(rateLimitDispatchId),
        userId: UserId.reconstitute(data.userId),
      }))
    ) {
      return skippedPushDelivery(data, "RATE_LIMITED");
    }

    const isEngagement =
      data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
    const settings = decidePushExpiry({
      candidate: data,
      data,
      timezone: recipient.timezone,
      expiresBeforeQuietHours: mustExpireBeforeQuietHours(data, preference.nightPushEnabled),
      now: this.#dependencies.clock.now(),
    });
    if (settings.status === "skipped") {
      return settings;
    }

    if (isMarketingDelivery(data)) {
      const consent = await this.#dependencies.userSettings.findConsentReadModel(
        UserId.reconstitute(data.userId),
      );
      if (!consent?.marketingPushAgreedAt) {
        return skippedPushDelivery(data, "MARKETING_CONSENT_REQUIRED");
      }
    }

    if (
      !hasReservedRateLimit &&
      isEngagement &&
      (await this.#dependencies.rateLimiter.reserveEngagement({
        dispatchId: PushDispatchId.reconstitute(rateLimitDispatchId),
        userId: UserId.reconstitute(data.userId),
        localDate: recipient.localDate,
      }))
    ) {
      return skippedPushDelivery(data, "ENGAGEMENT_RATE_LIMITED");
    }

    return settings;
  }
}
