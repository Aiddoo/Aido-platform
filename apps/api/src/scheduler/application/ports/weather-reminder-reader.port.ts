/**
 * 날씨 알림 수신자 조회 포트.
 *
 * 아침/저녁 날씨 알림의 위치 보유 유저·폴백(위치 없음) 유저 조회를 담당한다.
 */
import type {
	WeatherFallbackUser,
	WeatherReminderUser,
} from "./scheduler-read-models";

export const WEATHER_REMINDER_READER = Symbol("WEATHER_REMINDER_READER");

/** 날씨 알림 수신자 조회 파라미터 (커스텀 시:분) */
export interface WeatherReminderParams {
	readonly tz: string;
	readonly hour: number;
	readonly minute: number;
	/** catch-up 발송 시 특정 유저만 대상 */
	readonly userId?: string;
}

export interface WeatherReminderReaderPort {
	/** 아침 날씨 알림: 위치 보유 유저 */
	findWeatherMorningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]>;

	/** 아침 날씨 알림: 위치 없는 폴백 유저 */
	findWeatherMorningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]>;

	/** 저녁 날씨 알림: 위치 보유 유저 */
	findWeatherEveningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]>;

	/** 저녁 날씨 알림: 위치 없는 폴백 유저 */
	findWeatherEveningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]>;
}
