import { Inject, Injectable } from "@nestjs/common";

import { resolveDeliveryTimezone, resolveTimezone } from "@/shared/domain/date/utils/timezone";

import { isNightTime } from "../../domain/services/night-time";
import {
	isAutomatedEngagementNotification,
	isMarketingNotification,
	isNightExemptNotification,
} from "../../domain/services/push-eligibility";
import type { CreateNotificationData } from "../ports/notification-data";
import {
	NOTIFICATION_RECIPIENT_PREFERENCE_READER,
	type NotificationRecipientPreferenceReaderPort,
} from "../ports/notification-recipient-preference.reader.port";
import type { PushDispatchSkipReason } from "../ports/push-dispatch.repository.port";
import {
	PUSH_RATE_LIMITER,
	type PushRateLimitRequest,
	type PushRateLimiterPort,
} from "../ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type NotificationDeliveryPreference,
	type NotificationMarketingConsent,
	type UserNotificationSettingsPort,
} from "../ports/user-notification-settings.port";

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
}

/** 푸시 수신 설정·동의·야간 시간·빈도 제한 판단을 한곳에서 수행한다. */
@Injectable()
export class PushDeliveryEligibilityService {
	constructor(
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		@Inject(PUSH_RATE_LIMITER)
		private readonly rateLimiter: PushRateLimiterPort,
		@Inject(NOTIFICATION_RECIPIENT_PREFERENCE_READER)
		private readonly recipientPreferenceReader: NotificationRecipientPreferenceReaderPort,
	) {}

	async loadSingleRecipient(userId: string): Promise<SinglePushDeliveryRecipient> {
		const preference = await this.recipientPreferenceReader.getPreference(userId);
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
			this.userSettings.getPreferenceRecordsByUserIds(uniqueUserIds),
			this.userSettings.getConsentRecordsByUserIds(uniqueUserIds),
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
	): Promise<PushDeliveryEligibilityDecision<CreateNotificationData>> {
		const { preference } = recipient;
		if (!preference.pushEnabled) {
			return this.#skipped(data, "PUSH_DISABLED");
		}

		// 단건 경로는 기존 계약대로 일반 rate counter를 설정·야간·동의보다 먼저 예약한다.
		if (await this.rateLimiter.isRateLimited(data.userId)) {
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
			const consent = await this.userSettings.getConsentRecord(data.userId);
			if (!consent?.marketingPushAgreedAt) {
				return this.#skipped(data, "MARKETING_CONSENT_REQUIRED");
			}
		}

		if (
			isEngagement &&
			(await this.rateLimiter.isEngagementRateLimited(data.userId, recipient.localDate))
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
			this.#createRateLimitRequest(candidate.data, recipients.get(candidate.data.userId)),
		);
		const limited = await this.rateLimiter.reserveBatch(requests);

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
		recipient: BatchPushDeliveryRecipient | undefined,
	): PushRateLimitRequest {
		const isEngagement =
			data.purpose === "ENGAGEMENT" || isAutomatedEngagementNotification(data.type);
		return {
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
