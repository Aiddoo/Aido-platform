import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";
import { pick } from "es-toolkit";

import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type {
  TimeFormatValue,
  UserPreferenceRecord,
} from "../../domain/user-preference.constants.js";

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

/** 앱에 돌려주는 설정 값(locale 제외). 변경 요청은 이 필드 중 일부만 보낸다 */
export type PreferenceView = Omit<PreferenceSnapshot, "locale">;
export type PreferenceChanges = Partial<PreferenceView>;

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
] satisfies (keyof PreferenceView)[];

export function buildUpdatedPreferenceView(record: PreferenceSnapshot): PreferenceView {
  return pick(record, PREFERENCE_RESPONSE_FIELDS);
}

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

export function buildPreferenceView(
  snapshot: PreferenceSnapshot,
  hasPremium: boolean,
): PreferenceView {
  return {
    ...buildUpdatedPreferenceView(snapshot),
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

export function buildPreferenceSnapshot(record: UserPreferenceRecord): PreferenceSnapshot {
  return { ...pick(record, PREFERENCE_RESPONSE_FIELDS), locale: record.locale };
}
