import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, lt, or } from "drizzle-orm";
import { sortBy } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import {
  localTimeIn,
  resolveScheduledInstant,
} from "../../../shared/domain/todo-calendar.domain-service.js";
import {
  type TimedTodoQuery,
  type TimedTodoView,
  TodoScheduleReaderPort,
} from "../../application/ports/todo-schedule.reader.port.js";

@Injectable()
export class DrizzleTodoScheduleReader implements TodoScheduleReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async listPendingTimedTodos(query: TimedTodoQuery): Promise<TimedTodoView[]> {
    const { userIds, date, timezone, from, until } = query;
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#txHost.tx
      .select({
        id: todo.id,
        userId: todo.userId,
        title: todo.title,
        startDate: todo.startDate,
        scheduledLocalTime: todo.scheduledLocalTime,
        scheduledTime: todo.scheduledTime,
      })
      .from(todo)
      .where(
        and(
          inArray(todo.userId, [...userIds]),
          eq(todo.isAllDay, false),
          eq(todo.completed, false),
          or(
            and(gte(todo.scheduledTime, from), lt(todo.scheduledTime, until)),
            // 전날 이전에 시작해 그날까지 이어지는 여러 날 할 일. 시각은 시작일의 것이라 그날 벽시계로 다시 만든다
            and(lt(todo.startDate, date), gte(todo.endDate, date), isNotNull(todo.scheduledTime)),
          ),
        ),
      )
      .orderBy(asc(todo.scheduledTime), asc(todo.id));

    const todos = rows.flatMap(({ startDate, scheduledLocalTime, scheduledTime, ...row }) => {
      if (scheduledTime == null) {
        return [];
      }
      const scheduledAt =
        Temporal.PlainDate.compare(startDate, date) < 0
          ? resolveScheduledInstant(
              date.toString(),
              scheduledLocalTime ?? localTimeIn(scheduledTime, timezone),
              timezone,
            )
          : scheduledTime;
      if (scheduledAt == null) {
        return [];
      }
      const inWindow =
        Temporal.Instant.compare(scheduledAt, from) >= 0 &&
        Temporal.Instant.compare(scheduledAt, until) < 0;
      return inWindow ? [{ ...row, scheduledAt }] : [];
    });
    return sortBy(todos, [({ scheduledAt }) => scheduledAt.epochMilliseconds, ({ id }) => id]);
  }
}
