import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

/**
 * 푸시 토큰 등록 시 타임존 upsert (notification).
 *
 * 새 타임존이 등록되면 스케줄러의 활성 타임존 목록이 스테일해지므로,
 * upsert 후 activeTimezones 캐시를 무효화한다(update-preference와 대칭).
 */
interface UpsertPushTimezoneDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
  readonly cache: UserSettingsCachePort;
}

export class UpsertPushTimezone {
  readonly #dependencies: UpsertPushTimezoneDependencies;

  constructor(dependencies: UpsertPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, timezone: string): Promise<void> {
    await this.#dependencies.preferenceRepository.upsertTimezone(userId, timezone);
    await this.#dependencies.cache.invalidateActiveTimezones();
  }
}
