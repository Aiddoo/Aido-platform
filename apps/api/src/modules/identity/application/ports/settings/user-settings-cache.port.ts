import type { PreferenceSnapshot } from "../../read-models/settings/preference.read-model.js";

export const USER_SETTINGS_CACHE = Symbol("USER_SETTINGS_CACHE");

export interface UserSettingsCachePort {
  /** 사용자 설정 원본 스냅샷 조회 (캐시 wrap). */
  wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot>;

  /** 사용자 설정 캐시 무효화 (설정 쓰기 경로). */
  invalidateUserPreference(userId: string): Promise<void>;
}
