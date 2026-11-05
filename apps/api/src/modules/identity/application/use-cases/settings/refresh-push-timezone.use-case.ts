import type { ReminderTimezoneCachePort } from "#api/modules/notification/notification-reminders-cache.public";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import type { TodoTimezoneRebaseEnqueuerPort } from "../../ports/settings/todo-timezone-rebase.enqueuer.port.js";
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
  readonly todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
}

export class RefreshPushTimezone {
  readonly #dependencies: RefreshPushTimezoneDependencies;

  constructor(dependencies: RefreshPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RefreshPushTimezoneInput): Promise<void> {
    const { userId, timezone } = input;
    const changed = await this.#dependencies.unitOfWork.run(async () => {
      const count = await this.#dependencies.preferenceRepository.refreshTimezoneIfChanged(
        userId,
        timezone,
      );
      if (count === 0) {
        return false;
      }
      await this.#dependencies.todoTimezoneRebase.enqueueRebase(userId, now());
      return true;
    });
    if (!changed) {
      return;
    }

    await Promise.all([
      this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones(),
      this.#dependencies.cache.invalidateUserPreference(userId),
    ]);
  }
}
