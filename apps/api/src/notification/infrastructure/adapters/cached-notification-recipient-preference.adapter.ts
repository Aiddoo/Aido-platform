import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { DEFAULT_LOCALE, type SupportedLocale, toSupportedLocale } from "@/shared/domain/locale";
import {
	type CachedUserPreference,
	CacheService,
} from "@/shared/infrastructure/cache/cache.service";

import { type NotificationRecipientLocaleReaderPort } from "../../application/ports/notification-recipient-locale.reader.port";
import { type NotificationRecipientPreferenceReaderPort } from "../../application/ports/notification-recipient-preference.reader.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type NotificationDeliveryPreference,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";

@Injectable()
export class CachedNotificationRecipientPreferenceAdapter
	implements NotificationRecipientPreferenceReaderPort, NotificationRecipientLocaleReaderPort
{
	constructor(
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly userSettings: UserNotificationSettingsPort,
		private readonly cacheService: CacheService,
	) {}

	async getPreference(userId: string): Promise<NotificationDeliveryPreference> {
		const preference = await this.cacheService.wrapUserPreference(userId, () =>
			this.#loadPreference(userId),
		);
		return {
			...preference,
			locale: preference.locale ?? DEFAULT_LOCALE,
		};
	}

	async getLocale(userId: string): Promise<SupportedLocale> {
		const preference = await this.getPreference(userId);
		return toSupportedLocale(preference.locale);
	}

	async #loadPreference(userId: string): Promise<CachedUserPreference> {
		const preference = await this.userSettings.getPreferenceRecord(userId);
		if (preference) {
			return {
				pushEnabled: preference.pushEnabled,
				nightPushEnabled: preference.nightPushEnabled,
				timezone: preference.timezone,
				locale: preference.locale,
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

		return {
			pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
			nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
			timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
			locale: DEFAULT_LOCALE,
			morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
			morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
			eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
			eveningReminderMinute: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
			timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
			weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
			weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
			weatherMorningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
			weatherEveningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
			weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
			weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
		};
	}
}
