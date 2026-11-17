import type { PushDispatchSkipReason } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  localDateIn,
  resolveDeliveryTimezone,
  resolveTimezone,
} from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  type NotificationDeliveryPreference,
  type NotificationMarketingConsent,
  type UserNotificationSettingsPort,
} from "../../../shared/application/ports/user-notification-settings.port.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { reminderOccurrenceStart } from "../../../shared/domain/reminder-occurrence.domain-service.js";
import { resolvePushExpiry } from "../../domain/push-delivery-options.domain-service.js";
import {
  isAiPushDisabled,
  isAutomatedEngagementNotification,
  isGeneralRateLimitExemptNotification,
  isMarketingNotification,
  isNightExemptNotification,
} from "../../domain/push-eligibility.domain-service.js";
import { type NotificationRecipientPreferenceReaderPort } from "../ports/notification-recipient-preference.reader.port.js";
import {
  type PushRateLimitRequest,
  type PushRateLimiterPort,
} from "../ports/push-rate-limiter.port.js";

export interface SinglePushDeliveryRecipient {
  readonly userId: string;
  readonly preference: NotificationDeliveryPreference;
  readonly timezone: string;
  readonly localDate: string;
}

export interface BatchPushDeliveryRecipient {
  readonly userId: string;
  readonly preference: NotificationDeliveryPreference | undefined;
  readonly consent: NotificationMarketingConsent | undefined;
  readonly timezone: string;
  readonly localDate: string;
}

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

interface PushDeliveryCandidate {
  readonly data: CreateNotificationData;
  readonly rateLimitDispatchId: number;
}

interface PushDeliveryEligibilityServiceDependencies {
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "findConsentReadModel" | "findConsentReadModelsByUserIds" | "findPreferenceReadModelsByUserIds"
  >;
  readonly rateLimiter: Pick<
    PushRateLimiterPort,
    "reserveBatch" | "reserveEngagement" | "reserveGeneral"
  >;
  readonly recipientPreferenceReader: Pick<
    NotificationRecipientPreferenceReaderPort,
    "getPreference"
  >;
  readonly clock: ClockPort;
}

// 푸시 수신 설정·동의·야간 시간·빈도 제한 판단을 한곳에서 한다

export class EvaluatePushDeliveryEligibilityUseCase {
  readonly #dependencies: PushDeliveryEligibilityServiceDependencies;

  constructor(dependencies: PushDeliveryEligibilityServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async loadSingleRecipient(userId: string): Promise<SinglePushDeliveryRecipient> {
    const preference = await this.#dependencies.recipientPreferenceReader.getPreference(
      UserId.reconstitute(userId),
    );
    const timezone = resolveDeliveryTimezone(preference.timezone);
    return {
      userId,
      preference,
      timezone,
      localDate: this.#localDate(timezone),
    };
  }

  async loadBatchRecipients(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, BatchPushDeliveryRecipient>> {
    const uniqueUserIds = uniq(userIds);
    const [preferences, consents] = await Promise.all([
      this.#dependencies.userSettings.findPreferenceReadModelsByUserIds(
        uniqueUserIds.map((userId) => UserId.reconstitute(userId)),
      ),
      this.#dependencies.userSettings.findConsentReadModelsByUserIds(
        uniqueUserIds.map((userId) => UserId.reconstitute(userId)),
      ),
    ]);
    const preferenceByUserId = new Map(
      preferences.map((preference) => [preference.userId, preference]),
    );
    const consentByUserId = new Map(consents.map((consent) => [consent.userId, consent]));

    return new Map(
      uniqueUserIds.map((userId) => {
        const preference = preferenceByUserId.get(userId);
        const timezone = resolveDeliveryTimezone(preference?.timezone);
        return [
          userId,
          {
            userId,
            preference,
            consent: consentByUserId.get(userId),
            timezone,
            localDate: this.#localDate(timezone),
          },
        ];
      }),
    );
  }

  async evaluateSingle(
    data: CreateNotificationData,
    recipient: SinglePushDeliveryRecipient,
    rateLimitDispatchId: number,
    hasReservedRateLimit: boolean,
  ): Promise<PushDeliverySettingsDecision<CreateNotificationData>> {
    const { preference } = recipient;
    if (!preference.pushEnabled) {
      return this.#skipped(data, "PUSH_DISABLED");
    }
    if (isAiPushDisabled(data.type, preference)) {
      return this.#skipped(data, "AI_PUSH_DISABLED");
    }

    // 단건 경로는 기존 계약대로 일반 rate counter를 설정·야간·동의보다 먼저 예약한다.
    if (
      !hasReservedRateLimit &&
      !isGeneralRateLimitExemptNotification(data.type) &&
      (await this.#dependencies.rateLimiter.reserveGeneral({
        dispatchId: rateLimitDispatchId,
        userId: data.userId,
      }))
    ) {
      return this.#skipped(data, "RATE_LIMITED");
    }

    const isEngagement =
      data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
    const settings = this.#withExpiry(
      data,
      data,
      recipient.timezone,
      mustExpireBeforeQuietHours(data, preference.nightPushEnabled),
    );
    if (settings.status === "skipped") {
      return settings;
    }

    if (isMarketingDelivery(data)) {
      const consent = await this.#dependencies.userSettings.findConsentReadModel(
        UserId.reconstitute(data.userId),
      );
      if (!consent?.marketingPushAgreedAt) {
        return this.#skipped(data, "MARKETING_CONSENT_REQUIRED");
      }
    }

    if (
      !hasReservedRateLimit &&
      isEngagement &&
      (await this.#dependencies.rateLimiter.reserveEngagement({
        dispatchId: rateLimitDispatchId,
        userId: data.userId,
        localDate: recipient.localDate,
      }))
    ) {
      return this.#skipped(data, "ENGAGEMENT_RATE_LIMITED");
    }

    return settings;
  }

  evaluateBatchSettings<TCandidate extends PushDeliveryCandidate>(
    candidates: readonly TCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
  ): readonly PushDeliverySettingsDecision<TCandidate>[] {
    return candidates.map((candidate) => {
      const recipient = recipients.get(candidate.data.userId);
      // 관리자 강제 발송은 수신 설정(켜짐·야간)을 따르지 않는다. 광고성은 강제할 수 없다
      if (candidate.data.force === true && !isMarketingDelivery(candidate.data)) {
        return this.#withExpiry(
          candidate,
          candidate.data,
          recipient?.timezone ?? resolveDeliveryTimezone(undefined),
          false,
        );
      }
      return this.#batchSettingsDecision(candidate, recipient);
    });
  }

  async reserveBatch<TCandidate extends PushDeliveryCandidate>(
    candidates: readonly TCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
  ): Promise<readonly PushDeliveryEligibilityDecision<TCandidate>[]> {
    const reservable = candidates.filter(
      (candidate) => !isGeneralRateLimitExemptNotification(candidate.data.type),
    );
    const limited = await this.#dependencies.rateLimiter.reserveBatch(
      reservable.map((candidate) =>
        this.#createRateLimitRequest(
          candidate.data,
          candidate.rateLimitDispatchId,
          recipients.get(candidate.data.userId),
        ),
      ),
    );
    const limitedCandidates = new Set(reservable.filter((_, index) => limited[index]));

    return candidates.map((candidate) =>
      limitedCandidates.has(candidate)
        ? this.#skipped(candidate, "RATE_LIMITED")
        : { status: "eligible", candidate },
    );
  }

  #batchSettingsDecision<TCandidate extends PushDeliveryCandidate>(
    candidate: TCandidate,
    recipient: BatchPushDeliveryRecipient | undefined,
  ): PushDeliverySettingsDecision<TCandidate> {
    const { data } = candidate;
    if (!recipient?.preference) {
      return this.#skipped(candidate, "PUSH_SETTINGS_MISSING");
    }
    const { preference } = recipient;
    if (!preference.pushEnabled) {
      return this.#skipped(candidate, "PUSH_DISABLED");
    }
    if (isAiPushDisabled(data.type, preference)) {
      return this.#skipped(candidate, "AI_PUSH_DISABLED");
    }
    const settings = this.#withExpiry(
      candidate,
      data,
      recipient.timezone,
      mustExpireBeforeQuietHours(data, preference.nightPushEnabled),
    );
    if (settings.status === "skipped") {
      return settings;
    }
    if (isMarketingDelivery(data) && !recipient.consent?.marketingPushAgreedAt) {
      return this.#skipped(candidate, "MARKETING_CONSENT_REQUIRED");
    }
    return settings;
  }

  #createRateLimitRequest(
    data: CreateNotificationData,
    dispatchId: number,
    recipient: BatchPushDeliveryRecipient | undefined,
  ): PushRateLimitRequest {
    const isEngagement =
      data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
    return {
      dispatchId,
      userId: data.userId,
      ...(isEngagement && {
        engagementLocalDate:
          recipient?.localDate ??
          this.#localDate(resolveDeliveryTimezone(recipient?.preference?.timezone)),
      }),
    };
  }

  // 발송 판단의 현지 날짜(YYYY-MM-DD)는 rate limit·발송 context 키로 쓴다
  #localDate(timezone: string): string {
    return localDateIn(this.#dependencies.clock.now(), timezone).toString();
  }

  // 받는 사람 시간대로 공급자 보관 시간을 정하고, 야간 전에 사라져야 하는데 야간이 코앞이면 건너뛴다
  #withExpiry<TCandidate>(
    candidate: TCandidate,
    data: CreateNotificationData,
    timezone: string,
    expiresBeforeQuietHours: boolean,
  ): PushDeliverySettingsDecision<TCandidate> {
    const timeZone = TimeZone.reconstitute(resolveTimezone(timezone));
    const expiry = resolvePushExpiry({
      type: data.type,
      now: this.#dependencies.clock.now(),
      timeZone,
      expiresBeforeQuietHours,
      todoStartsAt:
        data.type === "TODO_REMINDER" && data.reminderOccurrenceKey != null
          ? reminderOccurrenceStart(data.reminderOccurrenceKey, timeZone)
          : null,
    });
    if (expiry.status === "quiet-hours") {
      return this.#skipped(
        candidate,
        isMarketingDelivery(data) ? "MARKETING_QUIET_HOURS" : "NIGHT_PUSH_DISABLED",
      );
    }
    return { status: "eligible", candidate, ttlSeconds: expiry.ttlSeconds };
  }

  #skipped<TCandidate>(
    candidate: TCandidate,
    reason: PushDispatchSkipReason,
  ): Extract<PushDeliveryEligibilityDecision<TCandidate>, { readonly status: "skipped" }> {
    return { status: "skipped", candidate, reason };
  }
}

function isMarketingDelivery(data: CreateNotificationData): boolean {
  return data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);
}

// 광고성은 늘, 그 밖은 야간 수신을 끈 사람에게 가는 야간 예외 아닌 알림만 야간 전에 사라져야 한다
function mustExpireBeforeQuietHours(
  data: CreateNotificationData,
  nightPushEnabled: boolean,
): boolean {
  return isMarketingDelivery(data) || (!nightPushEnabled && !isNightExemptNotification(data.type));
}
