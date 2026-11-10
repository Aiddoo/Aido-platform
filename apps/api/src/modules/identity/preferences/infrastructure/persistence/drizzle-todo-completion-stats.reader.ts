import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNull, lte, or } from "drizzle-orm";
import { sumBy } from "es-toolkit";

import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  TodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "../../application/ports/todo-completion-stats.reader.port.js";

// 스트릭용 하루 완료 집계. planning 모듈과의 순환을 피해 Todo 테이블을 직접 읽는다
@Injectable()
export class DrizzleTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
  readonly #db: Database;

  constructor(@Inject(DRIZZLE) db: Database) {
    this.#db = db;
  }

  async countForDay(userId: UserId, date: Temporal.PlainDate): Promise<TodoCompletionStats> {
    // 여러 날 할 일은 시작일부터 종료일까지 모든 날에 센다(planning의 날짜 조회와 같은 겹침 규칙)
    const spansDay = and(
      lte(todo.startDate, date),
      or(gte(todo.endDate, date), and(isNull(todo.endDate), gte(todo.startDate, date))),
    );
    const groups = await this.#db
      .select({ completed: todo.completed, count: count() })
      .from(todo)
      .where(and(eq(todo.userId, userId.value), spansDay))
      .groupBy(todo.completed);
    return {
      total: sumBy(groups, (group) => group.count),
      completed: groups.find((group) => group.completed)?.count ?? 0,
    };
  }
}
