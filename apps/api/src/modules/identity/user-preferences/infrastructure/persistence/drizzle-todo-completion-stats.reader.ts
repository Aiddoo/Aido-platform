import { Inject, Injectable } from "@nestjs/common";
import { count } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import { todosOnDay } from "#api/modules/planning/todos/planning-todos-queries.public";
import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  TodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "../../application/ports/todo-completion-stats.reader.port.js";

// 스트릭용 하루 완료 집계. planning 기능 Module과의 순환을 피해 planning이 연 하위 질의를 붙인다
@Injectable()
export class DrizzleTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
  readonly #db: Database;

  constructor(@Inject(DRIZZLE) db: Database) {
    this.#db = db;
  }

  async countForDay(userId: UserId, date: Temporal.PlainDate): Promise<TodoCompletionStats> {
    const day = todosOnDay(userId, date);
    const groups = await this.#db
      .select({ completed: day.completed, count: count() })
      .from(day)
      .groupBy(day.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }
}
