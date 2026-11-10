import { Injectable } from "@nestjs/common";

import { TodoScheduleReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import {
  type WeatherBriefingTodoQuery,
  WeatherBriefingTodoReaderPort,
} from "../../application/ports/weather-briefing-todo.reader.port.js";
import type { WeatherReminderTodo } from "../../application/read-models/scheduler.read-model.js";

/** 날씨 브리핑 화면과 같은 planning 조회 포트로 알림 대상의 오늘 할 일을 읽는다. */
@Injectable()
export class PlanningWeatherBriefingTodoAdapter implements WeatherBriefingTodoReaderPort {
  readonly #todoSchedule: Pick<TodoScheduleReaderPort, "listPendingTimedTodos">;

  constructor(todoSchedule: TodoScheduleReaderPort) {
    this.#todoSchedule = todoSchedule;
  }

  async listTodayTodos(query: WeatherBriefingTodoQuery): Promise<WeatherReminderTodo[]> {
    const todos = await this.#todoSchedule.listPendingTimedTodos({
      userIds: query.userIds.map((userId) => UserId.reconstitute(userId)),
      date: query.date,
      timezone: query.timezone,
      from: instantFromDate(query.from),
      until: instantFromDate(query.until),
    });
    return todos.map(({ id, userId, title, scheduledAt }) => ({
      id,
      userId,
      title,
      scheduledTime: instantToDate(scheduledAt),
    }));
  }
}
