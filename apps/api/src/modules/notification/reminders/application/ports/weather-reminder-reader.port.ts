import type {
  WeatherFallbackUser,
  WeatherReminderTodo,
  WeatherReminderUser,
} from "../read-models/scheduler.read-model.js";

export interface WeatherReminderParams {
  readonly tz: string;
  readonly hour: number;
  readonly minute: number;
  /** 리마인더 시간을 바꾼 직후 그 사용자만 볼 때 */
  readonly userId?: string;
}

/** [from, until) */
export interface WeatherReminderTodoQuery {
  readonly userIds: readonly string[];
  readonly from: Date;
  readonly until: Date;
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
  /** 시각을 정한(종일 아님) 미완료 할 일 중 [from, until) 안의 것. 시각 순이다 */
  abstract findScheduledTodosBetween(
    params: WeatherReminderTodoQuery,
  ): Promise<WeatherReminderTodo[]>;
}
