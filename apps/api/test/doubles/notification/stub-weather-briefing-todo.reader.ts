import {
  type WeatherBriefingTodoQuery,
  WeatherBriefingTodoReaderPort,
} from "#api/modules/notification/reminders/application/ports/weather-briefing-todo.reader.port";
import type { WeatherReminderTodo } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

// 할 일을 고정해 [from, until)·시각 순으로 고르고 조회 조건을 기록한다. 여러 날 할 일 규칙은 planning 조회 포트 몫이다
export class StubWeatherBriefingTodoReader extends WeatherBriefingTodoReaderPort {
  readonly queries: WeatherBriefingTodoQuery[] = [];
  todos: WeatherReminderTodo[] = [];

  async listTodayTodos(query: WeatherBriefingTodoQuery): Promise<WeatherReminderTodo[]> {
    this.queries.push({ ...query });
    const userIds = new Set(query.userIds.map((userId) => userId.value));
    return this.todos
      .filter(
        (todo) =>
          userIds.has(todo.userId) &&
          todo.scheduledTime.getTime() >= query.from.getTime() &&
          todo.scheduledTime.getTime() < query.until.getTime(),
      )
      .toSorted(
        (left, right) =>
          left.scheduledTime.getTime() - right.scheduledTime.getTime() || left.id - right.id,
      );
  }
}
