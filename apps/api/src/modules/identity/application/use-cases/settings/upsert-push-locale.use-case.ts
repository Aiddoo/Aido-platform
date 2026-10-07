import type { UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

export interface UpsertPushLocaleInput {
  readonly userId: string;
  readonly locale: string;
}

interface UpsertPushLocaleDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "upsertLocale">;
  readonly cache: Pick<UserSettingsCachePort, "invalidateUserPreference">;
}

export class UpsertPushLocale {
  readonly #dependencies: UpsertPushLocaleDependencies;

  constructor(dependencies: UpsertPushLocaleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertPushLocaleInput): Promise<void> {
    await this.#dependencies.preferenceRepository.upsertLocale(input.userId, input.locale);
    await this.#dependencies.cache.invalidateUserPreference(input.userId);
  }
}
