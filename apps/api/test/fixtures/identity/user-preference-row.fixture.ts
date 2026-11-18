import type { UserPreference } from "#test/types/database-rows";

let userPreferenceRowSequence = 0;

export function createUserPreferenceRowFixture(
  overrides: Partial<UserPreference> & Pick<UserPreference, "userId">,
): UserPreference {
  userPreferenceRowSequence += 1;
  return {
    id: `pref-${userPreferenceRowSequence}`,
    pushEnabled: true,
    nightPushEnabled: false,
    timezone: "UTC",
    locale: "ko",
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: 18,
    eveningReminderMinute: 0,
    timeFormat: "TWELVE_HOUR",
    weatherMorningEnabled: false,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: false,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
    aiPushEnabled: true,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    ...overrides,
  };
}
