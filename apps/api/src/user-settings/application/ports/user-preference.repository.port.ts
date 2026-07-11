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
	upsertLocale(userId: string, locale: string): Promise<void>;
	updateStreak(userId: string, state: StreakState): Promise<void>;
}

export const USER_PREFERENCE_REPOSITORY = Symbol("USER_PREFERENCE_REPOSITORY");
