import { mock } from "vitest-mock-extended";

import { UserPreferenceReader } from "#api/modules/identity/preferences/application/use-cases/read-user-preferences.use-case";
import type { UserConsentRecord } from "#api/modules/identity/preferences/domain/user-consent.constants";
import type { UserPreferenceRecord } from "#api/modules/identity/preferences/domain/user-preference.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserConsentBuilder, UserPreferenceBuilder } from "#test/builders/index";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";
import {
  StubUserPreferenceRepository,
  StubUserConsentRepository,
  StubUserSettingsCache,
  StubReminderTimezoneCache,
  StubPreferenceEntitlement,
  StubReminderScheduleEnqueuer,
  StubStreakMilestoneNotifier,
  StubTodoCompletionStatsReader,
  StubTodoTimezoneRebaseEnqueuer,
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
  if (input.premium) {
    entitlement.premiumUserIds.add(userId);
  }
  const reminderEnqueuer = new StubReminderScheduleEnqueuer();
  const milestoneNotifier = new StubStreakMilestoneNotifier();
  const statsReader = new StubTodoCompletionStatsReader();
  const logger = mock<ApplicationLoggerPort>();
  const todoTimezoneRebase = new StubTodoTimezoneRebaseEnqueuer();
  const unitOfWork = createUnitOfWorkMock();
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
    todoTimezoneRebase,
    unitOfWork,
  };
}
