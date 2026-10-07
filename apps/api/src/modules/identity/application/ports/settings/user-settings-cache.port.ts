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

  /** 활성 타임존 목록 캐시 무효화 (타임존/푸시 설정 변경 시 — 스케줄러 스윕 정합). */
  invalidateActiveTimezones(): Promise<void>;
}
