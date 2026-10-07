import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";

import type { UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

export interface UpsertPushTimezoneInput {
  readonly userId: string;
  readonly timezone: string;
}

interface UpsertPushTimezoneDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "upsertTimezone">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
}

export class UpsertPushTimezone {
  readonly #dependencies: UpsertPushTimezoneDependencies;

  constructor(dependencies: UpsertPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertPushTimezoneInput): Promise<void> {
    await this.#dependencies.preferenceRepository.upsertTimezone(input.userId, input.timezone);
    await Promise.all([
      this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones(),
      this.#dependencies.cache.invalidateUserPreference(input.userId),
    ]);
  }
}
