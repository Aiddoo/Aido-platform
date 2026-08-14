import {
	type PreferenceResponse,
	type UpdatePreferenceResponse,
	USER_PREFERENCE_DEFAULTS,
} from "@aido/validators";

import { DEFAULT_LOCALE } from "@/shared/domain/locale";

export type TimeFormatValue = "TWELVE_HOUR" | "TWENTY_FOUR_HOUR";

/**
 * 설정 스냅샷(캐시 대상).
 *
 * getPreference가 캐시에 저장하는 원본 설정. 프리미엄 게이팅은 스냅샷 위에서
 * 요청 시점에 적용한다. `locale`은 응답에는 없지만 푸시 언어 결정에 쓰이므로 보관한다.
 */
export interface PreferenceSnapshot {
	pushEnabled: boolean;
	nightPushEnabled: boolean;
	timezone: string;
	locale?: string;
	morningReminderHour: number;
	morningReminderMinute: number;
	eveningReminderHour: number;
	eveningReminderMinute: number;
	timeFormat: TimeFormatValue;
	weatherMorningEnabled: boolean;
	weatherMorningHour: number;
	weatherMorningMinute: number;
	weatherEveningEnabled: boolean;
	weatherEveningHour: number;
	weatherEveningMinute: number;
}

/** 갱신 결과의 15개 응답 필드(프리미엄 게이팅 없음 — 저장된 값 그대로) */
export function buildUpdatedPreferenceView(record: PreferenceSnapshot): UpdatePreferenceResponse {
	return {
		pushEnabled: record.pushEnabled,
		nightPushEnabled: record.nightPushEnabled,
		timezone: record.timezone,
		morningReminderHour: record.morningReminderHour,
		morningReminderMinute: record.morningReminderMinute,
		eveningReminderHour: record.eveningReminderHour,
		eveningReminderMinute: record.eveningReminderMinute,
		timeFormat: record.timeFormat,
		weatherMorningEnabled: record.weatherMorningEnabled,
		weatherMorningHour: record.weatherMorningHour,
		weatherMorningMinute: record.weatherMorningMinute,
		weatherEveningEnabled: record.weatherEveningEnabled,
		weatherEveningHour: record.weatherEveningHour,
		weatherEveningMinute: record.weatherEveningMinute,
	};
}

/** 설정 미존재 시 기본 스냅샷 */
export const DEFAULT_PREFERENCE_SNAPSHOT: PreferenceSnapshot = {
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

/**
 * 설정 스냅샷 + 프리미엄 여부 → 응답 뷰.
 *
 * 비프리미엄은 아침/저녁 리마인더 시간이 기본값(08:00/19:00)으로 고정된다.
 */
export function buildPreferenceView(
	snapshot: PreferenceSnapshot,
	hasPremium: boolean,
): PreferenceResponse {
	return {
		pushEnabled: snapshot.pushEnabled,
		nightPushEnabled: snapshot.nightPushEnabled,
		timezone: snapshot.timezone,
		morningReminderHour: hasPremium
			? snapshot.morningReminderHour
			: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
		morningReminderMinute: hasPremium
			? snapshot.morningReminderMinute
			: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
		eveningReminderHour: hasPremium
			? snapshot.eveningReminderHour
			: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
		eveningReminderMinute: hasPremium
			? snapshot.eveningReminderMinute
			: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
		timeFormat: snapshot.timeFormat,
		weatherMorningEnabled: snapshot.weatherMorningEnabled,
		weatherMorningHour: snapshot.weatherMorningHour,
		weatherMorningMinute: snapshot.weatherMorningMinute,
		weatherEveningEnabled: snapshot.weatherEveningEnabled,
		weatherEveningHour: snapshot.weatherEveningHour,
		weatherEveningMinute: snapshot.weatherEveningMinute,
	};
}
