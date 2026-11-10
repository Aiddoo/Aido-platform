import type { PreferenceSnapshot } from "../read-models/preference.read-model.js";

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_SETTINGS_CACHE = Symbol("USER_SETTINGS_CACHE");

export abstract class UserSettingsCachePort {
  /** 사용자 설정 원본 스냅샷 조회 (캐시 wrap). */
  abstract wrapUserPreference(
    userId: string,
    factory: () => Promise<PreferenceSnapshot>,
  ): Promise<PreferenceSnapshot>;

  /** 사용자 설정 캐시 무효화 (설정 쓰기 경로). */
  abstract invalidateUserPreference(userId: string): Promise<void>;
}
