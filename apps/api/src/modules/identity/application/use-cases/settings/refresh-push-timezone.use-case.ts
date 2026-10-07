import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";

/**
 * 타임존 자가치유 (인증 요청의 X-Timezone 헤더 기반, 핫패스).
 *
 * 앱은 매 인증요청에 실제 타임존을 보내지만, 과거에 헤더를 못 받은 유저는
 * `UserPreference.timezone`이 기본값 "UTC"에 머물러 발송 시각·야간 게이트가 어긋난다.
 * 이 유스케이스는 저장값과 다를 때만 갱신(조건부 no-op 쓰기)하고, 실제 갱신된
 * 경우에만 activeTimezones 캐시를 무효화해 sweep 캐시 thundering-herd를 피한다.
 *
 * `upsertPushTimezone`(토큰 등록용, 무조건 upsert + 무조건 캐시 무효화)과 달리
 * 신규 행을 생성하지 않고, 변경 없을 때 부수효과가 전혀 없다.
 */
interface RefreshPushTimezoneDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
  readonly cache: UserSettingsCachePort;
}

export class RefreshPushTimezone {
  readonly #dependencies: RefreshPushTimezoneDependencies;

  constructor(dependencies: RefreshPushTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, timezone: string): Promise<void> {
    const changed = await this.#dependencies.preferenceRepository.refreshTimezoneIfChanged(
      userId,
      timezone,
    );
    if (changed > 0) {
      await this.#dependencies.cache.invalidateActiveTimezones();
    }
  }
}
