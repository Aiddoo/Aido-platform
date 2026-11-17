import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderTime } from "../../domain/local-clock.domain-service.js";
import type {
  WeatherFallbackUserReadModel,
  WeatherReminderUserReadModel,
} from "../read-models/scheduler.read-model.js";

export interface WeatherReminderParams {
  /** 이 분에 현지 날짜·시·분이 같은 시간대들 */
  readonly timezones: readonly string[];
  /** 이 분에 울릴 날씨 알림 시:분들(reminderTimesDueAt) */
  readonly times: readonly ReminderTime[];
  /** 리마인더 시간을 바꾼 직후 그 사용자만 볼 때 */
  readonly userId?: UserId;
}

export abstract class WeatherReminderReaderPort {
  abstract findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]>;
  abstract findWeatherMorningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]>;
  abstract findWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]>;
  abstract findWeatherEveningFallbackUsers(
    params: WeatherReminderParams,
  ): Promise<WeatherFallbackUserReadModel[]>;
}
