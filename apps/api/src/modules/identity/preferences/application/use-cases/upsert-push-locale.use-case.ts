import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";

export interface UpsertPushLocaleCommand {
  readonly userId: string;
  readonly locale: string;
}

interface UpsertPushLocaleDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "upsertLocale">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
}

export class UpsertPushLocaleUseCase {
  readonly #dependencies: UpsertPushLocaleDependencies;

  constructor(dependencies: UpsertPushLocaleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertPushLocaleCommand): Promise<void> {
    const userId = UserId.reconstitute(input.userId);
    await this.#dependencies.preferenceRepository.upsertLocale(userId, input.locale);
    await this.#dependencies.cache.invalidateUserPreference(userId);
  }
}
