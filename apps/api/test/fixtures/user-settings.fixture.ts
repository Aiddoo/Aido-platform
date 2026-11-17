import type { UserConsentReadModel } from "#api/modules/identity/user-preferences/application/read-models/consent.read-model";
import type { UserPreferenceReadModel } from "#api/modules/identity/user-preferences/application/read-models/preference.read-model";
import { ReadUserPreferencesUseCase } from "#api/modules/identity/user-preferences/application/use-cases/read-user-preferences.use-case";
import { InMemoryUserConsentRepository } from "#test/doubles/identity/in-memory-user-consent.repository";
import { InMemoryUserPreferenceRepository } from "#test/doubles/identity/in-memory-user-preference.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
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
    preference?: Partial<UserPreferenceReadModel> | null;
    consent?: Partial<UserConsentReadModel> | null;
    premium?: boolean;
  } = {},
) {
  const userId = input.userId ?? "settings-user";
  const preference: UserPreferenceReadModel = {
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
    aiPushEnabled: true,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    ...input.preference,
  };
  const consent: UserConsentReadModel = {
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
  const consentRepository = new InMemoryUserConsentRepository({
    records: input.consent === null ? [] : [consent],
  });
  const preferenceRepository = new InMemoryUserPreferenceRepository(
    input.preference === null ? [] : [preference],
    consentRepository,
  );
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
    mutationLock: new RecordingMutationLock(),
    unitOfWork: new ImmediateUnitOfWork(),
    clock: new FixedClock(SETTINGS_TIME),
  };
}
