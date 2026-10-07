import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";

import type { UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

export interface RefreshPushTimezoneInput {
  readonly userId: string;
  readonly timezone: string;
}

interface RefreshPushTimezoneDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "refreshTimezoneIfChanged">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
}

export class RefreshPushTimezone {
  readonly #dependencies: RefreshPushTimezoneDependencies;

  constructor(dependencies: RefreshPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RefreshPushTimezoneInput): Promise<void> {
    const changed = await this.#dependencies.preferenceRepository.refreshTimezoneIfChanged(
      input.userId,
      input.timezone,
    );
    if (changed === 0) {
      return;
    }

    await Promise.all([
      this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones(),
      this.#dependencies.cache.invalidateUserPreference(input.userId),
    ]);
  }
}
