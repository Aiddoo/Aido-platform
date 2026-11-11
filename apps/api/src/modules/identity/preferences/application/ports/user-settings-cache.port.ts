import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PreferenceSnapshot } from "../read-models/preference.read-model.js";

export abstract class UserSettingsCachePort {
  /** 사용자 설정 원본 스냅샷 조회 (캐시 wrap). */
  abstract wrapUserPreference(
    userId: UserId,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot>;

  /** 사용자 설정 캐시 무효화 (설정 쓰기 경로). */
  abstract invalidateUserPreference(userId: UserId): Promise<void>;
}
