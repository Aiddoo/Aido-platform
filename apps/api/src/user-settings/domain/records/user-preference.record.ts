import type { TimeFormatValue } from "../services/preference-view";

/**
 * 설정 레코드(리포지토리 읽기 모델).
 *
 * Prisma UserPreference와 구조적으로 호환되며, 도메인은 Prisma enum에 의존하지
 * 않으므로 timeFormat은 도메인 유니온으로 노출한다.
 */
export interface UserPreferenceRecord {
	pushEnabled: boolean;
	nightPushEnabled: boolean;
	timezone: string;
	locale: string;
	morningReminderHour: number;
	morningReminderMinute: number;
	eveningReminderHour: number;
	eveningReminderMinute: number;
	timeFormat: TimeFormatValue;
	weatherMorningEnabled: boolean;
	weatherMorningHour: number;
	weatherMorningMinute: number;
	weatherEveningEnabled: boolean;
	weatherEveningHour: number;
	weatherEveningMinute: number;
	currentStreak: number;
	longestStreak: number;
	lastCompletedDate: Date | null;
}
