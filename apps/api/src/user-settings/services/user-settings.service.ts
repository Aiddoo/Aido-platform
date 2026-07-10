import {
	type ConsentResponse,
	type PreferenceResponse,
	type UpdateMarketingConsentResponse,
	type UpdatePreferenceInput,
	type UpdatePreferenceResponse,
	USER_PREFERENCE_DEFAULTS,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import type { TimeFormat } from "@/generated/prisma/enums";
import type { ReminderHourChangedJobData } from "@/scheduler/queue/timezone-reminder-queue.constants";
import { TimezoneReminderQueueService } from "@/scheduler/queue/timezone-reminder-queue.service";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { toISOStringOrNull } from "@/shared/domain/date/utils/format";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DEFAULT_LOCALE } from "@/shared/presentation/decorators";

import { UserConsentRepository } from "../repositories/user-consent.repository";
import { UserPreferenceRepository } from "../repositories/user-preference.repository";

@Injectable()
export class UserSettingsService {
	readonly #logger = new Logger(UserSettingsService.name);

	constructor(
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly userConsentRepository: UserConsentRepository,
		private readonly entitlementService: EntitlementService,
		private readonly timezoneReminderQueueService: TimezoneReminderQueueService,
		private readonly cacheService: CacheService,
	) {}

	async getPreference(userId: string): Promise<PreferenceResponse> {
		const preference = await this.cacheService.wrapUserPreference(
			userId,
			async () => {
				const raw = await this.userPreferenceRepository.findByUserId(userId);
				if (!raw) {
					return {
						pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
						nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
						timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
						locale: DEFAULT_LOCALE,
						morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
						morningReminderMinute:
							USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
						eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
						eveningReminderMinute:
							USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
						timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
						weatherMorningEnabled:
							USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
						weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
						weatherMorningMinute:
							USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
						weatherEveningEnabled:
							USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
						weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
						weatherEveningMinute:
							USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
					};
				}
				return {
					pushEnabled: raw.pushEnabled,
					nightPushEnabled: raw.nightPushEnabled,
					timezone: raw.timezone,
					locale: raw.locale,
					morningReminderHour: raw.morningReminderHour,
					morningReminderMinute: raw.morningReminderMinute,
					eveningReminderHour: raw.eveningReminderHour,
					eveningReminderMinute: raw.eveningReminderMinute,
					timeFormat: raw.timeFormat,
					weatherMorningEnabled: raw.weatherMorningEnabled,
					weatherMorningHour: raw.weatherMorningHour,
					weatherMorningMinute: raw.weatherMorningMinute,
					weatherEveningEnabled: raw.weatherEveningEnabled,
					weatherEveningHour: raw.weatherEveningHour,
					weatherEveningMinute: raw.weatherEveningMinute,
				};
			},
		);

		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);

		if (!hasPremium) {
			return {
				pushEnabled: preference.pushEnabled,
				nightPushEnabled: preference.nightPushEnabled,
				timezone: preference.timezone,
				morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
				morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
				eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
				eveningReminderMinute: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
				timeFormat: preference.timeFormat,
				weatherMorningEnabled: preference.weatherMorningEnabled,
				weatherMorningHour: preference.weatherMorningHour,
				weatherMorningMinute: preference.weatherMorningMinute,
				weatherEveningEnabled: preference.weatherEveningEnabled,
				weatherEveningHour: preference.weatherEveningHour,
				weatherEveningMinute: preference.weatherEveningMinute,
			};
		}

		return {
			pushEnabled: preference.pushEnabled,
			nightPushEnabled: preference.nightPushEnabled,
			timezone: preference.timezone,
			morningReminderHour: preference.morningReminderHour,
			morningReminderMinute: preference.morningReminderMinute,
			eveningReminderHour: preference.eveningReminderHour,
			eveningReminderMinute: preference.eveningReminderMinute,
			timeFormat: preference.timeFormat,
			weatherMorningEnabled: preference.weatherMorningEnabled,
			weatherMorningHour: preference.weatherMorningHour,
			weatherMorningMinute: preference.weatherMorningMinute,
			weatherEveningEnabled: preference.weatherEveningEnabled,
			weatherEveningHour: preference.weatherEveningHour,
			weatherEveningMinute: preference.weatherEveningMinute,
		};
	}

	async updatePreference(
		userId: string,
		input: UpdatePreferenceInput,
	): Promise<UpdatePreferenceResponse> {
		// 리마인더 시간 변경 시 프리미엄 체크
		if (
			input.morningReminderHour !== undefined ||
			input.morningReminderMinute !== undefined ||
			input.eveningReminderHour !== undefined ||
			input.eveningReminderMinute !== undefined
		) {
			const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
			if (!hasPremium) {
				throw BusinessExceptions.reminderPremiumRequired();
			}
		}

		// 리마인더 시간 범위 검증 (오전: 0-11, 오후: 12-23)
		if (
			input.morningReminderHour !== undefined &&
			input.morningReminderHour > 11
		) {
			throw BusinessExceptions.reminderHourOutOfRange();
		}
		if (
			input.eveningReminderHour !== undefined &&
			input.eveningReminderHour < 12
		) {
			throw BusinessExceptions.reminderHourOutOfRange();
		}

		// upsert로 없으면 생성, 있으면 업데이트
		const updated = await this.userPreferenceRepository.upsert(userId, {
			pushEnabled: input.pushEnabled,
			nightPushEnabled: input.nightPushEnabled,
			timezone: input.timezone,
			morningReminderHour: input.morningReminderHour,
			morningReminderMinute: input.morningReminderMinute,
			eveningReminderHour: input.eveningReminderHour,
			eveningReminderMinute: input.eveningReminderMinute,
			timeFormat: input.timeFormat as TimeFormat | undefined,
			weatherMorningEnabled: input.weatherMorningEnabled,
			weatherMorningHour: input.weatherMorningHour,
			weatherMorningMinute: input.weatherMorningMinute,
			weatherEveningEnabled: input.weatherEveningEnabled,
			weatherEveningHour: input.weatherEveningHour,
			weatherEveningMinute: input.weatherEveningMinute,
		});
		await this.cacheService.invalidateUserPreference(userId);

		// 타임존 또는 pushEnabled 변경 시 활성 타임존 목록 캐시 무효화
		if (input.timezone !== undefined || input.pushEnabled !== undefined) {
			await this.cacheService.invalidateActiveTimezones();
		}

		this.#logger.log(
			`User ${userId} updated preference: pushEnabled=${updated.pushEnabled}, nightPushEnabled=${updated.nightPushEnabled}, timezone=${updated.timezone}`,
		);

		// 리마인더 시간 변경 시 즉시 반영 큐 잡 등록
		// (현재 시간과 동일한 시간으로 변경했을 때 크론이 이미 지나간 경우 보완)
		if (
			input.morningReminderHour !== undefined ||
			input.morningReminderMinute !== undefined ||
			input.eveningReminderHour !== undefined ||
			input.eveningReminderMinute !== undefined
		) {
			this.timezoneReminderQueueService.enqueueReminderHourChanged({
				userId,
				timezone: updated.timezone,
				morningReminderHour: input.morningReminderHour,
				morningReminderMinute: input.morningReminderMinute,
				eveningReminderHour: input.eveningReminderHour,
				eveningReminderMinute: input.eveningReminderMinute,
			} satisfies ReminderHourChangedJobData);
		}

		return {
			pushEnabled: updated.pushEnabled,
			nightPushEnabled: updated.nightPushEnabled,
			timezone: updated.timezone,
			morningReminderHour: updated.morningReminderHour,
			morningReminderMinute: updated.morningReminderMinute,
			eveningReminderHour: updated.eveningReminderHour,
			eveningReminderMinute: updated.eveningReminderMinute,
			timeFormat: updated.timeFormat,
			weatherMorningEnabled: updated.weatherMorningEnabled,
			weatherMorningHour: updated.weatherMorningHour,
			weatherMorningMinute: updated.weatherMorningMinute,
			weatherEveningEnabled: updated.weatherEveningEnabled,
			weatherEveningHour: updated.weatherEveningHour,
			weatherEveningMinute: updated.weatherEveningMinute,
		};
	}

	async getConsent(userId: string): Promise<ConsentResponse> {
		const consent = await this.userConsentRepository.findByUserId(userId);

		// 동의 기록이 없으면 기본값 반환 (기존 사용자 호환성)
		if (!consent) {
			return {
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
		}

		return {
			termsAgreedAt: toISOStringOrNull(consent.termsAgreedAt),
			privacyAgreedAt: toISOStringOrNull(consent.privacyAgreedAt),
			agreedTermsVersion: consent.agreedTermsVersion,
			marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
		};
	}

	async updateMarketingConsent(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingConsentResponse> {
		// upsert로 없으면 생성, 있으면 업데이트
		const updated = await this.userConsentRepository.upsertMarketingConsent(
			userId,
			{ agreed },
		);

		this.#logger.log(
			`User ${userId} updated marketing consent: agreed=${agreed}`,
		);

		return {
			marketingAgreedAt: toISOStringOrNull(updated.marketingAgreedAt),
		};
	}
}
