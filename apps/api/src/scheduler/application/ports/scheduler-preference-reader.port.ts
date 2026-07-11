/**
 * 유저 환경설정(UserPreference) 조회 포트.
 *
 * 오케스트레이터의 활성 타임존 목록 조회와, 전략들의 푸시 로케일 일괄 조회를 담당한다.
 * (활성 타임존은 어댑터에서 캐시 스루로 조회 — 캐싱은 인프라 관심사)
 */
import type { UserLocaleMap } from "./scheduler-read-models";

export const SCHEDULER_PREFERENCE_READER = Symbol(
	"SCHEDULER_PREFERENCE_READER",
);

export interface SchedulerPreferenceReaderPort {
	/** 활성화된 고유 타임존 목록 (모든 유저 대상, 캐시 스루) */
	findActiveTimezones(): Promise<string[]>;

	/** 유저들의 푸시 로케일 일괄 조회 (preference 없으면 ko) */
	findUserLocales(userIds: string[]): Promise<UserLocaleMap>;
}
