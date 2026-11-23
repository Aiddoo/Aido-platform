import {
  type WeatherReminderParams,
  WeatherReminderReaderPort,
} from "#api/modules/notification/reminders/application/ports/weather-reminder-reader.port";
import type {
  WeatherFallbackUserReadModel,
  WeatherReminderUserReadModel,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

// 아침·저녁 날씨 알림 수신자를 고정해 돌려주고 조회 조건을 기록한다
export class StubWeatherReminderReader extends WeatherReminderReaderPort {
  readonly userParams: WeatherReminderParams[] = [];
  usersWithLocation: WeatherReminderUserReadModel[] = [];
  fallbackUsers: WeatherFallbackUserReadModel[] = [];

  async listWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async listWeatherMorningFallbackUsers(): Promise<WeatherFallbackUserReadModel[]> {
    return this.fallbackUsers;
  }

  async listWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUserReadModel[]> {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async listWeatherEveningFallbackUsers(): Promise<WeatherFallbackUserReadModel[]> {
    return this.fallbackUsers;
  }
}
