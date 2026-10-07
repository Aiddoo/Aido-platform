import { resolveDeliveryTimezone, resolveTimezone } from "#api/shared/domain/date/utils/timezone";

import { isNightTime } from "../../../domain/services/delivery/night-time.js";
import {
  isAutomatedEngagementNotification,
  isMarketingNotification,
  isNightExemptNotification,
} from "../../../domain/services/delivery/push-eligibility.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { type NotificationRecipientPreferenceReaderPort } from "../../ports/delivery/notification-recipient-preference.reader.port.js";
import {
  type PushRateLimitRequest,
  type PushRateLimiterPort,
} from "../../ports/delivery/push-rate-limiter.port.js";
import {
  type NotificationDeliveryPreference,
  type NotificationMarketingConsent,
  type UserNotificationSettingsPort,
} from "../../ports/delivery/user-notification-settings.port.js";
import type { PushDispatchSkipReason } from "../../types/delivery/push-delivery.types.js";

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

interface PushDeliveryCandidate {
  readonly data: CreateNotificationData;
  readonly rateLimitDispatchId: number;
}

/** 푸시 수신 설정·동의·야간 시간·빈도 제한 판단을 한곳에서 수행한다. */
interface PushDeliveryEligibilityServiceDependencies {
  readonly userSettings: Pick<
    UserNotificationSettingsPort,
    "getConsentRecord" | "getConsentRecordsByUserIds" | "getPreferenceRecordsByUserIds"
  >;
  readonly rateLimiter: Pick<
    PushRateLimiterPort,
    "reserveBatch" | "reserveEngagement" | "reserveGeneral"
  >;
  readonly recipientPreferenceReader: Pick<
    NotificationRecipientPreferenceReaderPort,
    "getPreference"
  >;
}

export class PushDeliveryEligibilityService {
  readonly #dependencies: PushDeliveryEligibilityServiceDependencies;

  constructor(dependencies: PushDeliveryEligibilityServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async loadSingleRecipient(userId: string): Promise<SinglePushDeliveryRecipient> {
    const preference = await this.#dependencies.recipientPreferenceReader.getPreference(userId);
    const timezone = resolveDeliveryTimezone(preference.timezone);
    return {
      userId,
      preference,
      timezone,
      localDate: this.#formatLocalDate(timezone),
    };
  }

  async loadBatchRecipients(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, BatchPushDeliveryRecipient>> {
    const uniqueUserIds = [...new Set(userIds)];
    const [preferences, consents] = await Promise.all([
      this.#dependencies.userSettings.getPreferenceRecordsByUserIds(uniqueUserIds),
      this.#dependencies.userSettings.getConsentRecordsByUserIds(uniqueUserIds),
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
            localDate: this.#formatLocalDate(timezone),
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
  ): Promise<PushDeliveryEligibilityDecision<CreateNotificationData>> {
    const { preference } = recipient;
    if (!preference.pushEnabled) {
      return this.#skipped(data, "PUSH_DISABLED");
    }

    // 단건 경로는 기존 계약대로 일반 rate counter를 설정·야간·동의보다 먼저 예약한다.
    if (
      !hasReservedRateLimit &&
      (await this.#dependencies.rateLimiter.reserveGeneral({
        dispatchId: rateLimitDispatchId,
        userId: data.userId,
      }))
    ) {
      return this.#skipped(data, "RATE_LIMITED");
    }

    const isEngagement =
      data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
    const isMarketing = data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);

    if (isNightTime(recipient.timezone) && isMarketing) {
      return this.#skipped(data, "MARKETING_QUIET_HOURS");
    }

    if (
      isNightTime(recipient.timezone) &&
      !preference.nightPushEnabled &&
      !isNightExemptNotification(data.type)
    ) {
      return this.#skipped(data, "NIGHT_PUSH_DISABLED");
    }

    if (isMarketing) {
      const consent = await this.#dependencies.userSettings.getConsentRecord(data.userId);
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

    return { status: "eligible", candidate: data };
  }

  evaluateBatchSettings<TCandidate extends PushDeliveryCandidate>(
    candidates: readonly TCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
  ): readonly PushDeliveryEligibilityDecision<TCandidate>[] {
    return candidates.map((candidate) => {
      const recipient = recipients.get(candidate.data.userId);
      const forced =
        candidate.data.force === true &&
        candidate.data.purpose !== "ENGAGEMENT" &&
        !isMarketingNotification(candidate.data.type);
      if (forced) return { status: "eligible", candidate };

      const reason = this.#batchSettingsSkipReason(candidate.data, recipient);
      return reason ? this.#skipped(candidate, reason) : { status: "eligible", candidate };
    });
  }

  async reserveBatch<TCandidate extends PushDeliveryCandidate>(
    candidates: readonly TCandidate[],
    recipients: ReadonlyMap<string, BatchPushDeliveryRecipient>,
  ): Promise<readonly PushDeliveryEligibilityDecision<TCandidate>[]> {
    const requests = candidates.map((candidate) =>
      this.#createRateLimitRequest(
        candidate.data,
        candidate.rateLimitDispatchId,
        recipients.get(candidate.data.userId),
      ),
    );
    const limited = await this.#dependencies.rateLimiter.reserveBatch(requests);

    return candidates.map((candidate, index) =>
      limited[index] ? this.#skipped(candidate, "RATE_LIMITED") : { status: "eligible", candidate },
    );
  }

  #batchSettingsSkipReason(
    data: CreateNotificationData,
    recipient: BatchPushDeliveryRecipient | undefined,
  ): PushDispatchSkipReason | null {
    if (!recipient?.preference) return "PUSH_SETTINGS_MISSING";
    if (!recipient.preference.pushEnabled) return "PUSH_DISABLED";

    const isMarketing = data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);
    if (isNightTime(recipient.timezone) && isMarketing) {
      return "MARKETING_QUIET_HOURS";
    }
    if (
      isNightTime(recipient.timezone) &&
      !recipient.preference.nightPushEnabled &&
      !isNightExemptNotification(data.type)
    ) {
      return "NIGHT_PUSH_DISABLED";
    }
    if (isMarketing && !recipient.consent?.marketingPushAgreedAt) {
      return "MARKETING_CONSENT_REQUIRED";
    }
    return null;
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
          this.#formatLocalDate(resolveDeliveryTimezone(recipient?.preference?.timezone)),
      }),
    };
  }

  #formatLocalDate(timezone: string): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: resolveTimezone(timezone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  #skipped<TCandidate>(
    candidate: TCandidate,
    reason: PushDispatchSkipReason,
  ): PushDeliveryEligibilityDecision<TCandidate> {
    return { status: "skipped", candidate, reason };
  }
}
