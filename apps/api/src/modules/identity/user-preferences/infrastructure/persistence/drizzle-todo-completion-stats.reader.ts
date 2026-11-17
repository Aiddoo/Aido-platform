import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
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
    // planning 날짜 조회(todoDateCondition)와 같은 겹침 규칙·모양이다. 두 갈래라야 날짜 인덱스를 탄다
    const spansDay = or(
      and(isNotNull(todo.endDate), lte(todo.startDate, date), gte(todo.endDate, date)),
      and(isNull(todo.endDate), eq(todo.startDate, date)),
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
