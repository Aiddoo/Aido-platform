import { DEFAULT_LOCALE, USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";
import { pick } from "es-toolkit";

import type { StreakState } from "../../domain/streak.vo.js";
import type { UserPreferenceSettings } from "../../domain/user-preference.aggregate.js";
import type { TimeFormatValue } from "../../domain/user-preference.constants.js";

/** 설정 행 한 줄. 다른 Context가 발송 판단에 읽는다 */
export type UserPreferenceReadModel = UserPreferenceSettings &
  StreakState & { readonly userId: string };

export interface PreferenceSettingsReadModel {
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
  aiPushEnabled: boolean;
}

/** 앱에 돌려주는 설정 값(locale 제외). 변경 요청은 이 필드 중 일부만 보낸다 */
export type PreferenceReadModel = Omit<PreferenceSettingsReadModel, "locale">;

const PREFERENCE_RESPONSE_FIELDS = [
  "pushEnabled",
  "nightPushEnabled",
  "timezone",
  "morningReminderHour",
  "morningReminderMinute",
  "eveningReminderHour",
  "eveningReminderMinute",
  "timeFormat",
  "weatherMorningEnabled",
  "weatherMorningHour",
  "weatherMorningMinute",
  "weatherEveningEnabled",
  "weatherEveningHour",
  "weatherEveningMinute",
  "aiPushEnabled",
] satisfies (keyof PreferenceReadModel)[];

export function toUpdatedPreferenceReadModel(
  record: PreferenceSettingsReadModel,
): PreferenceReadModel {
  return pick(record, PREFERENCE_RESPONSE_FIELDS);
}

export const DEFAULT_PREFERENCE_SETTINGS: PreferenceSettingsReadModel = {
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
  aiPushEnabled: USER_PREFERENCE_DEFAULTS.AI_PUSH_ENABLED,
};

export function toPreferenceReadModel(
  snapshot: PreferenceSettingsReadModel,
  hasPremium: boolean,
): PreferenceReadModel {
  return {
    ...toUpdatedPreferenceReadModel(snapshot),
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
  };
}

export function toPreferenceSettingsReadModel(
  record: UserPreferenceSettings,
): PreferenceSettingsReadModel {
  return { ...pick(record, PREFERENCE_RESPONSE_FIELDS), locale: record.locale };
}
