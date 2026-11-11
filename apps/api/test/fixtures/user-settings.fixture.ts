import type { UserConsentRecordWithId } from "#api/modules/identity/preferences/application/ports/user-consent.repository.port";
import type { UserPreferenceRecordWithId } from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import { ReadUserPreferencesUseCase } from "#api/modules/identity/preferences/application/use-cases/read-user-preferences.use-case";
import { InMemoryUserConsentRepository } from "#test/doubles/identity/in-memory-user-consent.repository";
import { InMemoryUserPreferenceRepository } from "#test/doubles/identity/in-memory-user-preference.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  StubPreferenceEntitlement,
  StubReminderScheduleEnqueuer,
  StubReminderTimezoneCache,
  StubStreakMilestoneNotifier,
  StubTodoCompletionStatsReader,
  StubTodoTimezoneRebaseEnqueuer,
  StubUserSettingsCache,
} from "#test/mocks/ports/user-settings.stub";

export const SETTINGS_TIME = Temporal.Instant.from("2026-01-16T09:00:00.000Z");

export function createUserSettingsFixture(
  input: {
    userId?: string;
    preference?: Partial<UserPreferenceRecordWithId> | null;
    consent?: Partial<UserConsentRecordWithId> | null;
    premium?: boolean;
  } = {},
) {
  const userId = input.userId ?? "settings-user";
  const preference: UserPreferenceRecordWithId = {
    userId,
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
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    ...input.preference,
  };
  const consent: UserConsentRecordWithId = {
    userId,
    termsAgreedAt: SETTINGS_TIME,
    privacyAgreedAt: SETTINGS_TIME,
    agreedTermsVersion: "1.0.0",
    marketingAgreedAt: null,
    marketingPushAgreedAt: null,
    aiDataSharingAgreedAt: null,
    aiDataSharingVersion: null,
    marketingReconfirmedAt: null,
    ...input.consent,
  };
  const preferenceRepository = new InMemoryUserPreferenceRepository(
    input.preference === null ? [] : [preference],
  );
  const consentRepository = new InMemoryUserConsentRepository({
    records: input.consent === null ? [] : [consent],
  });
  const cache = new StubUserSettingsCache();
  const preferenceReader = new ReadUserPreferencesUseCase({ preferenceRepository, cache });
  const entitlement = new StubPreferenceEntitlement();
  if (input.premium) {
    entitlement.premiumUserIds.add(userId);
  }
  return {
    userId,
    preference,
    consent,
    preferenceReader,
    preferenceRepository,
    consentRepository,
    cache,
    reminderTimezoneCache: new StubReminderTimezoneCache(),
    entitlement,
    reminderEnqueuer: new StubReminderScheduleEnqueuer(),
    milestoneNotifier: new StubStreakMilestoneNotifier(),
    statsReader: new StubTodoCompletionStatsReader(),
    logger: new SilentLogger(),
    todoTimezoneRebase: new StubTodoTimezoneRebaseEnqueuer(),
    unitOfWork: new ImmediateUnitOfWork(),
    clock: new FixedClock(SETTINGS_TIME),
  };
}
