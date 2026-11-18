import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderTimezoneCachePort } from "../ports/reminder-timezone-cache.port.js";
import type { TodoTimezoneRebaseEnqueuerPort } from "../ports/todo-timezone-rebase-enqueuer.port.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import { UserPreferenceLockKeys } from "../user-preferences.lock-keys.js";

export interface UpsertPushTimezoneCommand {
  readonly userId: string;
  readonly timezone: string;
}

interface UpsertPushTimezoneDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "getByUserId" | "save">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
  readonly reminderTimezoneCache: ReminderTimezoneCachePort;
  readonly todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
}

export class UpsertPushTimezoneUseCase {
  readonly #dependencies: UpsertPushTimezoneDependencies;

  constructor(dependencies: UpsertPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertPushTimezoneCommand): Promise<void> {
    const { timezone } = input;
    const userId = UserId.reconstitute(input.userId);
    const { preferenceRepository } = this.#dependencies;
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([UserPreferenceLockKeys.preference(userId)]);
      const preference = await preferenceRepository.getByUserId(userId);
      if (!preference.changeTimezone(timezone)) {
        return;
      }
      await preferenceRepository.save(preference);
      await this.#dependencies.todoTimezoneRebase.enqueueRebase(
        userId,
        this.#dependencies.clock.now(),
      );
    });
    await Promise.all([
      this.#dependencies.reminderTimezoneCache.invalidateActiveTimezones(),
      this.#dependencies.cache.invalidateUserPreference(userId),
    ]);
  }
}
