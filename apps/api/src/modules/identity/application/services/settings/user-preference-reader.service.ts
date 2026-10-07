import type { UserPreferenceReaderPort } from "../../ports/settings/user-preference.reader.port.js";
import type { UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import type { UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";
import {
  buildPreferenceSnapshot,
  DEFAULT_PREFERENCE_SNAPSHOT,
  type PreferenceSnapshot,
} from "../../read-models/settings/preference.read-model.js";

interface UserPreferenceReaderDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "findByUserId">;
  readonly cache: Pick<UserSettingsCachePort, "wrapUserPreference">;
}

export class UserPreferenceReader implements UserPreferenceReaderPort {
  readonly #dependencies: UserPreferenceReaderDependencies;

  constructor(dependencies: UserPreferenceReaderDependencies) {
    this.#dependencies = dependencies;
  }

  read(userId: string): Promise<PreferenceSnapshot> {
    return this.#dependencies.cache.wrapUserPreference(userId, async () => {
      const preference = await this.#dependencies.preferenceRepository.findByUserId(userId);
      return preference === null
        ? { ...DEFAULT_PREFERENCE_SNAPSHOT }
        : buildPreferenceSnapshot(preference);
    });
  }
}
