import type { userConsent, userPreference } from "#api/platform/database/schema/index";

import type { UserPreferenceReadModel } from "../../application/read-models/preference.read-model.js";
import {
  UserPreference,
  type UserPreferenceSettings,
} from "../../domain/user-preference.aggregate.js";

type UserPreferenceRow = typeof userPreference.$inferSelect;
type UserConsentRow = typeof userConsent.$inferSelect;

export function toUserPreference(
  userId: string,
  rows: { readonly preference: UserPreferenceRow | null; readonly consent: UserConsentRow | null },
): UserPreference {
  const { preference, consent } = rows;
  return UserPreference.reconstitute({
    userId,
    settings: preference == null ? null : toSettings(preference),
    streak:
      preference == null
        ? null
        : {
            currentStreak: preference.currentStreak,
            longestStreak: preference.longestStreak,
            lastCompletedDate: preference.lastCompletedDate,
          },
    consent: {
      userId,
      termsAgreedAt: consent?.termsAgreedAt ?? null,
      privacyAgreedAt: consent?.privacyAgreedAt ?? null,
      agreedTermsVersion: consent?.agreedTermsVersion ?? null,
      marketingAgreedAt: consent?.marketingAgreedAt ?? null,
      marketingPushAgreedAt: consent?.marketingPushAgreedAt ?? null,
      aiDataSharingAgreedAt: consent?.aiDataSharingAgreedAt ?? null,
      aiDataSharingVersion: consent?.aiDataSharingVersion ?? null,
    },
  });
}

export function toUserPreferenceReadModel(row: UserPreferenceRow): UserPreferenceReadModel {
  return {
    ...toSettings(row),
    userId: row.userId,
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastCompletedDate: row.lastCompletedDate,
  };
}

function toSettings(row: UserPreferenceRow): UserPreferenceSettings {
  return {
    pushEnabled: row.pushEnabled,
    nightPushEnabled: row.nightPushEnabled,
    timezone: row.timezone,
    locale: row.locale,
    morningReminderHour: row.morningReminderHour,
    morningReminderMinute: row.morningReminderMinute,
    eveningReminderHour: row.eveningReminderHour,
    eveningReminderMinute: row.eveningReminderMinute,
    timeFormat: row.timeFormat,
    weatherMorningEnabled: row.weatherMorningEnabled,
    weatherMorningHour: row.weatherMorningHour,
    weatherMorningMinute: row.weatherMorningMinute,
    weatherEveningEnabled: row.weatherEveningEnabled,
    weatherEveningHour: row.weatherEveningHour,
    weatherEveningMinute: row.weatherEveningMinute,
    aiPushEnabled: row.aiPushEnabled,
  };
}
