import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import {
  toPreferenceSettingsReadModel,
  DEFAULT_PREFERENCE_SETTINGS,
  type PreferenceSettingsReadModel,
} from "../read-models/preference.read-model.js";

interface UserPreferenceReaderDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findReadModelByUserId">;
  readonly cache: Pick<UserSettingsCachePort, "wrapUserPreference">;
}

export class ReadUserPreferencesUseCase {
  readonly #dependencies: UserPreferenceReaderDependencies;

  constructor(dependencies: UserPreferenceReaderDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userId: UserId): Promise<PreferenceSettingsReadModel> {
    return this.#dependencies.cache.wrapUserPreference(userId, async () => {
      const preference =
        await this.#dependencies.preferenceRepository.findReadModelByUserId(userId);
      return preference == null
        ? { ...DEFAULT_PREFERENCE_SETTINGS }
        : toPreferenceSettingsReadModel(preference);
    });
  }
}
