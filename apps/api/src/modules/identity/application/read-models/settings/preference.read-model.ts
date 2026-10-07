import {
  type PreferenceResponse,
  type UpdatePreferenceResponse,
  USER_PREFERENCE_DEFAULTS,
} from "@aido/api";
import { pick } from "es-toolkit";

import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type {
  TimeFormatValue,
  UserPreferenceRecord,
} from "../../../domain/records/settings/user-preference.record.js";

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
] satisfies (keyof UpdatePreferenceResponse)[];

export function buildUpdatedPreferenceView(record: PreferenceSnapshot): UpdatePreferenceResponse {
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
): PreferenceResponse {
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
