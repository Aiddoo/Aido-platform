import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { ReminderTimezoneCachePort } from "../ports/reminder-timezone-cache.port.js";
import type { TodoTimezoneRebaseEnqueuerPort } from "../ports/todo-timezone-rebase-enqueuer.port.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";

export interface RefreshPushTimezoneCommand {
  readonly userId: string;
  readonly timezone: string;
}

interface RefreshPushTimezoneDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "refreshTimezoneIfChanged">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
  readonly todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
}

export class RefreshPushTimezoneUseCase {
  readonly #dependencies: RefreshPushTimezoneDependencies;

  constructor(dependencies: RefreshPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RefreshPushTimezoneCommand): Promise<void> {
    const { timezone } = input;
    const userId = UserId.reconstitute(input.userId);
    const changed = await this.#dependencies.unitOfWork.run(async () => {
      const count = await this.#dependencies.preferenceRepository.refreshTimezoneIfChanged(
        userId,
        timezone,
      );
      if (count === 0) {
        return false;
      }
      await this.#dependencies.todoTimezoneRebase.enqueueRebase(
        userId,
        instantToDate(this.#dependencies.clock.now()),
      );
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
