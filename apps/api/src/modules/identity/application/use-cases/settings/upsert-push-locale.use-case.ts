import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";

/** 푸시 토큰 등록 시 로케일 upsert (notification). */
interface UpsertPushLocaleDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
}

export class UpsertPushLocale {
  readonly #dependencies: UpsertPushLocaleDependencies;

  constructor(dependencies: UpsertPushLocaleDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userId: string, locale: string): Promise<void> {
    return this.#dependencies.preferenceRepository.upsertLocale(userId, locale);
  }
}
