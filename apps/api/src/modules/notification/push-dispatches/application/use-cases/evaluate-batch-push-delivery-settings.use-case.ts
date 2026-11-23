import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { resolveDeliveryTimezone } from "#api/shared/domain/time/timezone-name";

import {
  decidePushExpiry,
  isMarketingDelivery,
  mustExpireBeforeQuietHours,
  type PushDeliverySettingsDecision,
  skippedPushDelivery,
} from "../../domain/push-delivery-decision.domain-service.js";
import { isAiPushDisabled } from "../../domain/push-eligibility.domain-service.js";
import type { BatchPushDeliveryRecipient } from "./load-push-delivery-recipients.use-case.js";
import type { PushDeliveryCandidate } from "./reserve-batch-push-rate-limits.use-case.js";

export interface EvaluateBatchPushDeliverySettingsCommand<TCandidate> {
  readonly candidates: readonly TCandidate[];
  readonly recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>;
}

interface EvaluateBatchPushDeliverySettingsDependencies {
  readonly clock: ClockPort;
}

// 배치 푸시는 미리 읽은 설정·동의로 수신 설정·야간 시간을 판단한다. 빈도 제한은 따로 예약한다
export class EvaluateBatchPushDeliverySettingsUseCase {
  readonly #dependencies: EvaluateBatchPushDeliverySettingsDependencies;

  constructor(dependencies: EvaluateBatchPushDeliverySettingsDependencies) {
    this.#dependencies = dependencies;
  }

  execute<TCandidate extends PushDeliveryCandidate>(
    command: EvaluateBatchPushDeliverySettingsCommand<TCandidate>,
  ): readonly PushDeliverySettingsDecision<TCandidate>[] {
    const now = this.#dependencies.clock.now();
    return command.candidates.map((candidate) => {
      const recipient = command.recipients.get(candidate.data.userId);
      // 관리자 강제 발송은 수신 설정(켜짐·야간)을 따르지 않는다. 광고성은 강제할 수 없다
      if (candidate.data.force === true && !isMarketingDelivery(candidate.data)) {
        return decidePushExpiry({
          candidate,
          data: candidate.data,
          timezone: recipient?.timezone ?? resolveDeliveryTimezone(undefined),
          expiresBeforeQuietHours: false,
          now,
        });
      }
      return settingsDecision(candidate, recipient, now);
    });
  }
}

function settingsDecision<TCandidate extends PushDeliveryCandidate>(
  candidate: TCandidate,
  recipient: BatchPushDeliveryRecipient | undefined,
  now: Temporal.Instant,
): PushDeliverySettingsDecision<TCandidate> {
  const { data } = candidate;
  if (!recipient?.preference) {
    return skippedPushDelivery(candidate, "PUSH_SETTINGS_MISSING");
  }
  const { preference } = recipient;
  if (!preference.pushEnabled) {
    return skippedPushDelivery(candidate, "PUSH_DISABLED");
  }
  if (isAiPushDisabled(data.type, preference)) {
    return skippedPushDelivery(candidate, "AI_PUSH_DISABLED");
  }
  const settings = decidePushExpiry({
    candidate,
    data,
    timezone: recipient.timezone,
    expiresBeforeQuietHours: mustExpireBeforeQuietHours(data, preference.nightPushEnabled),
    now,
  });
  if (settings.status === "skipped") {
    return settings;
  }
  if (isMarketingDelivery(data) && !recipient.consent?.marketingPushAgreedAt) {
    return skippedPushDelivery(candidate, "MARKETING_CONSENT_REQUIRED");
  }
  return settings;
}
