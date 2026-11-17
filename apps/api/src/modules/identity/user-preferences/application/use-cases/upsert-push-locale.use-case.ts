import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import { UserPreferenceLockKeys } from "../user-preferences.lock-keys.js";

export interface UpsertPushLocaleCommand {
  readonly userId: string;
  readonly locale: string;
}

interface UpsertPushLocaleDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "getByUserId" | "save">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
}

export class UpsertPushLocaleUseCase {
  readonly #dependencies: UpsertPushLocaleDependencies;

  constructor(dependencies: UpsertPushLocaleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertPushLocaleCommand): Promise<void> {
    const userId = UserId.reconstitute(input.userId);
    const { preferenceRepository } = this.#dependencies;
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([UserPreferenceLockKeys.preference(userId)]);
      const preference = await preferenceRepository.getByUserId(userId);
      if (preference.changeLocale(input.locale)) {
        await preferenceRepository.save(preference);
      }
    });
    await this.#dependencies.cache.invalidateUserPreference(userId);
  }
}
