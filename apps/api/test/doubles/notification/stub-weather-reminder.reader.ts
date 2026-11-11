import {
  type WeatherReminderParams,
  WeatherReminderReaderPort,
} from "#api/modules/notification/reminders/application/ports/weather-reminder-reader.port";
import type {
  WeatherFallbackUser,
  WeatherReminderUser,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

// 아침·저녁 날씨 알림 수신자를 고정해 돌려주고 조회 조건을 기록한다
export class StubWeatherReminderReader extends WeatherReminderReaderPort {
  readonly userParams: WeatherReminderParams[] = [];
  usersWithLocation: WeatherReminderUser[] = [];
  fallbackUsers: WeatherFallbackUser[] = [];

  async findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]> {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async findWeatherMorningFallbackUsers(): Promise<WeatherFallbackUser[]> {
    return this.fallbackUsers;
  }

  async findWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]> {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async findWeatherEveningFallbackUsers(): Promise<WeatherFallbackUser[]> {
    return this.fallbackUsers;
  }
}
