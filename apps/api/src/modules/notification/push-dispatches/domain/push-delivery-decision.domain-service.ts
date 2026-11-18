import type { PushDispatchSkipReason } from "@aido/api/vocabulary";

import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import type { CreateNotificationData } from "../../shared/domain/notification-draft.constants.js";
import { todoReminderPushEndsAt } from "../../shared/domain/reminder-occurrence.domain-service.js";
import { resolvePushExpiry } from "./push-delivery-options.domain-service.js";
import {
  isMarketingNotification,
  isNightExemptNotification,
} from "./push-eligibility.domain-service.js";

export type PushDeliveryEligibilityDecision<TCandidate> =
  | {
      readonly status: "eligible";
      readonly candidate: TCandidate;
    }
  | {
      readonly status: "skipped";
      readonly candidate: TCandidate;
      readonly reason: PushDispatchSkipReason;
    };

// 설정 판단을 통과하면 받는 사람 기준 공급자 보관 시간도 함께 정한다
export type PushDeliverySettingsDecision<TCandidate> =
  | {
      readonly status: "eligible";
      readonly candidate: TCandidate;
      readonly ttlSeconds: number;
    }
  | {
      readonly status: "skipped";
      readonly candidate: TCandidate;
      readonly reason: PushDispatchSkipReason;
    };

export interface PushExpiryDecisionInput<TCandidate> {
  readonly candidate: TCandidate;
  readonly data: CreateNotificationData;
  readonly timezone: string;
  readonly expiresBeforeQuietHours: boolean;
  readonly now: Temporal.Instant;
}

export function skippedPushDelivery<TCandidate>(
  candidate: TCandidate,
  reason: PushDispatchSkipReason,
): Extract<PushDeliveryEligibilityDecision<TCandidate>, { readonly status: "skipped" }> {
  return { status: "skipped", candidate, reason };
}

export function isMarketingDelivery(data: CreateNotificationData): boolean {
  return data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);
}

// 광고성은 늘, 그 밖은 야간 수신을 끈 사람에게 가는 야간 예외 아닌 알림만 야간 전에 사라져야 한다
export function mustExpireBeforeQuietHours(
  data: CreateNotificationData,
  nightPushEnabled: boolean,
): boolean {
  return isMarketingDelivery(data) || (!nightPushEnabled && !isNightExemptNotification(data.type));
}

// 받는 사람 시간대로 공급자 보관 시간을 정하고, 야간 전에 사라져야 하는데 야간이 코앞이면 건너뛴다
export function decidePushExpiry<TCandidate>(
  input: PushExpiryDecisionInput<TCandidate>,
): PushDeliverySettingsDecision<TCandidate> {
  const { candidate, data } = input;
  const timeZone = TimeZone.reconstitute(resolveTimezone(input.timezone));
  const expiry = resolvePushExpiry({
    type: data.type,
    now: input.now,
    timeZone,
    expiresBeforeQuietHours: input.expiresBeforeQuietHours,
    reminderEndsAt: data.type === "TODO_REMINDER" ? todoReminderPushEndsAt(data, timeZone) : null,
  });
  if (expiry.status === "quiet-hours") {
    return skippedPushDelivery(
      candidate,
      isMarketingDelivery(data) ? "MARKETING_QUIET_HOURS" : "NIGHT_PUSH_DISABLED",
    );
  }
  return { status: "eligible", candidate, ttlSeconds: expiry.ttlSeconds };
}
