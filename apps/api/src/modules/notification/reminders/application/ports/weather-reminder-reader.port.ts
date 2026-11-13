import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  WeatherFallbackUser,
  WeatherReminderUser,
} from "../read-models/scheduler.read-model.js";

export interface WeatherReminderParams {
  /** 이 분에 현지 날짜·시·분이 같은 시간대들 */
  readonly timezones: readonly string[];
  readonly hour: number;
  readonly minute: number;
  /** 리마인더 시간을 바꾼 직후 그 사용자만 볼 때 */
  readonly userId?: UserId;
}

export abstract class WeatherReminderReaderPort {
  abstract findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]>;
  abstract findWeatherMorningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUser[]>;
  abstract findWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]>;
  abstract findWeatherEveningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUser[]>;
}
