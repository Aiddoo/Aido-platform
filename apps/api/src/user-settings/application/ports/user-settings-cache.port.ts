import type { PreferenceSnapshot } from "../../domain/services/preference-view";

export const USER_SETTINGS_CACHE = Symbol("USER_SETTINGS_CACHE");

/**
 * User-settings 관련 캐시 포트 (cache 인프라 경계)
 *
 * application 계층은 공유 CacheService 대신 이 포트에만 의존한다. 키 관리·TTL은
 * 어댑터(→CacheService/CacheKeys)가 소유하고, 여기서는 설정 캐시 시맨틱만 노출한다.
 *
 * 사용자 설정 스냅샷은 원본(프리미엄 게이팅 적용 전)을 캐시하며, 쓰기 경로에서
 * 명시적으로 무효화한다. 활성 타임존 목록은 스케줄러가 소비하므로 타임존/푸시
 * 설정 변경 시 함께 무효화한다.
 */
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
