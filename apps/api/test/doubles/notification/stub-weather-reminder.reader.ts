import {
  type WeatherReminderParams,
  WeatherReminderReaderPort,
  type WeatherReminderTodoQuery,
} from "#api/modules/notification/reminders/application/ports/weather-reminder-reader.port";
import type {
  WeatherFallbackUser,
  WeatherReminderTodo,
  WeatherReminderUser,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

// 아침·저녁 날씨 알림 수신자와 할 일을 고정해 돌려주고 조회 조건을 기록한다. 할 일은 [from, until)·시각 순으로 고른다
export class StubWeatherReminderReader extends WeatherReminderReaderPort {
  readonly userParams: WeatherReminderParams[] = [];
  readonly todoQueries: WeatherReminderTodoQuery[] = [];
  usersWithLocation: WeatherReminderUser[] = [];
  fallbackUsers: WeatherFallbackUser[] = [];
  todos: WeatherReminderTodo[] = [];

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

  async findScheduledTodosBetween(
    params: WeatherReminderTodoQuery,
  ): Promise<WeatherReminderTodo[]> {
    this.todoQueries.push({ ...params });
    const userIds = new Set(params.userIds);
    return this.todos
      .filter(
        (todo) =>
          userIds.has(todo.userId) &&
          todo.scheduledTime.getTime() >= params.from.getTime() &&
          todo.scheduledTime.getTime() < params.until.getTime(),
      )
      .toSorted(
        (left, right) =>
          left.scheduledTime.getTime() - right.scheduledTime.getTime() || left.id - right.id,
      );
  }
}
