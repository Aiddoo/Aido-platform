import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceReaderPort } from "../ports/user-preference.reader.port.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../ports/user-settings-cache.port.js";
import {
  buildPreferenceSnapshot,
  DEFAULT_PREFERENCE_SNAPSHOT,
  type PreferenceSnapshot,
} from "../read-models/preference.read-model.js";

interface UserPreferenceReaderDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserId">;
  readonly cache: Pick<UserSettingsCachePort, "wrapUserPreference">;
}

export class ReadUserPreferencesUseCase implements UserPreferenceReaderPort {
  readonly #dependencies: UserPreferenceReaderDependencies;

  constructor(dependencies: UserPreferenceReaderDependencies) {
    this.#dependencies = dependencies;
  }

  read(userId: UserId): Promise<PreferenceSnapshot> {
    return this.#dependencies.cache.wrapUserPreference(userId, async () => {
      const preference = await this.#dependencies.preferenceRepository.findByUserId(userId);
      return preference == null
        ? { ...DEFAULT_PREFERENCE_SNAPSHOT }
        : buildPreferenceSnapshot(preference);
    });
  }
}
