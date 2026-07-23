import type { StreakState } from "../../domain/entities/streak.entity";
import type { UserPreferenceRecord } from "../../domain/records/user-preference.record";
import type { TimeFormatValue } from "../../domain/services/preference-view";

export type { UserPreferenceRecord };

/** 배치 조회용 설정 레코드 (사용자 식별자 포함). */
export type UserPreferenceRecordWithId = UserPreferenceRecord & {
	userId: string;
};

/** 설정 upsert 입력 (부분 갱신) */
export interface PreferenceWriteInput {
	pushEnabled?: boolean;
	nightPushEnabled?: boolean;
	timezone?: string;
	morningReminderHour?: number;
	morningReminderMinute?: number;
	eveningReminderHour?: number;
	eveningReminderMinute?: number;
	timeFormat?: TimeFormatValue;
	weatherMorningEnabled?: boolean;
	weatherMorningHour?: number;
	weatherMorningMinute?: number;
	weatherEveningEnabled?: boolean;
	weatherEveningHour?: number;
	weatherEveningMinute?: number;
}

/**
 * 설정 리포지토리 포트.
 */
export interface UserPreferenceRepositoryPort {
	findByUserId(userId: string): Promise<UserPreferenceRecord | null>;
	findByUserIds(userIds: string[]): Promise<UserPreferenceRecordWithId[]>;
	create(
		userId: string,
		data?: PreferenceWriteInput,
	): Promise<UserPreferenceRecord>;
	upsert(
		userId: string,
		data: PreferenceWriteInput,
	): Promise<UserPreferenceRecord>;
	upsertTimezone(userId: string, timezone: string): Promise<void>;
	/**
	 * 저장된 타임존이 다를 때만 갱신하고, 실제 갱신된 행 수를 반환한다.
	 *
	 * 자가치유(핫패스)용 — 값이 같으면 0행(no-op)이라 쓰기 증폭·캐시 무효화가 없다.
	 * 행이 없으면(설정 미생성) 0을 반환한다(신규 생성하지 않음 — 토큰 등록 upsert가 담당).
	 */
	refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number>;
	upsertLocale(userId: string, locale: string): Promise<void>;
	updateStreak(userId: string, state: StreakState): Promise<void>;
}

export const USER_PREFERENCE_REPOSITORY = Symbol("USER_PREFERENCE_REPOSITORY");
