import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import type {
  TodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "../../application/ports/todo-completion-stats.reader.port.js";

/**
 * Drizzle 투두 완료 통계 리더.
 *
 * 스트릭 갱신용으로 특정 날짜의 투두 총계/완료 수를 직접 집계한다
 * (todo 모듈 순환 회피).
 */
@Injectable()
export class DrizzleTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
  readonly #db: Database;

  constructor(@Inject(DRIZZLE) db: Database) {
    this.#db = db;
  }

  async countForDay(userId: string, dayStart: Date, dayEnd: Date): Promise<TodoCompletionStats> {
    const groups = await this.#db
      .select({ completed: todo.completed, count: count() })
      .from(todo)
      .where(
        and(eq(todo.userId, userId), gte(todo.startDate, dayStart), lt(todo.startDate, dayEnd)),
      )
      .groupBy(todo.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }
}
