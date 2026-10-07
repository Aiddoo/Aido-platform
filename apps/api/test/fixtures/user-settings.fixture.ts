import { mock } from "vitest-mock-extended";

import { UserPreferenceReader } from "#api/modules/identity/application/services/settings/user-preference-reader.service";
import type { UserConsentRecord } from "#api/modules/identity/domain/records/settings/user-consent.record";
import type { UserPreferenceRecord } from "#api/modules/identity/domain/records/settings/user-preference.record";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { UserConsentBuilder, UserPreferenceBuilder } from "#test/builders/index";
import {
  StubUserPreferenceRepository,
  StubUserConsentRepository,
  StubUserSettingsCache,
  StubReminderTimezoneCache,
  StubPreferenceEntitlement,
  StubReminderScheduleEnqueuer,
  StubStreakMilestoneNotifier,
  StubTodoCompletionStatsReader,
} from "#test/mocks/ports/user-settings.stub";

export const SETTINGS_TIME = new Date("2026-01-16T09:00:00.000Z");

export function createUserSettingsFixture(
  input: {
    userId?: string;
    preference?: Partial<UserPreferenceRecord> | null;
    consent?: Partial<UserConsentRecord> | null;
    premium?: boolean;
  } = {},
) {
  const userId = input.userId ?? "settings-user";
  const preference = { ...UserPreferenceBuilder.create(userId).build(), ...input.preference };
  const consent = { ...UserConsentBuilder.create(userId).build(), ...input.consent };
  const preferenceRepository = new StubUserPreferenceRepository(
    input.preference === null ? [] : [[userId, preference]],
  );
  const consentRepository = new StubUserConsentRepository(
    input.consent === null ? [] : [[userId, consent]],
  );
  const cache = new StubUserSettingsCache();
  const reminderTimezoneCache = new StubReminderTimezoneCache();
  const preferenceReader = new UserPreferenceReader({ preferenceRepository, cache });
  const entitlement = new StubPreferenceEntitlement();
  if (input.premium) entitlement.premiumUserIds.add(userId);
  const reminderEnqueuer = new StubReminderScheduleEnqueuer();
  const milestoneNotifier = new StubStreakMilestoneNotifier();
  const statsReader = new StubTodoCompletionStatsReader();
  const logger = mock<ApplicationLogger>();
  return {
    userId,
    preference,
    consent,
    preferenceReader,
    preferenceRepository,
    consentRepository,
    cache,
    reminderTimezoneCache,
    entitlement,
    reminderEnqueuer,
    milestoneNotifier,
    statsReader,
    logger,
  };
}
