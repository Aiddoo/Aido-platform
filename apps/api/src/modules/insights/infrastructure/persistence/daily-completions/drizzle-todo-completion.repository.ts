import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { sumBy, uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import type {
  AggregateByDateRangeParams,
  TodoCompletionRepositoryPort,
} from "../../../application/ports/daily-completions/todo-completion.repository.port.js";
import type { TodoAggregateByDate } from "../../../domain/records/daily-completions/daily-completion.record.js";

@Injectable()
export class DrizzleTodoCompletionRepository implements TodoCompletionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  aggregateByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]> {
    return this.#aggregate(params, false);
  }

  aggregatePublicByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]> {
    return this.#aggregate(params, true);
  }

  async #aggregate(
    params: AggregateByDateRangeParams,
    publicOnly: boolean,
  ): Promise<TodoAggregateByDate[]> {
    const groups = await this.db
      .select({
        startDate: todo.startDate,
        categoryId: todo.categoryId,
        completed: todo.completed,
        count: count(),
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, params.userId),
          gte(todo.startDate, params.startDate),
          lt(todo.startDate, params.endDate),
          publicOnly ? eq(todo.visibility, "PUBLIC") : undefined,
        ),
      )
      .groupBy(todo.startDate, todo.categoryId, todo.completed);
    if (groups.length === 0) {
      return [];
    }

    const categories = await this.db.query.todoCategory.findMany({
      columns: { id: true, color: true },
      where: { id: { in: uniq(groups.map((group) => group.categoryId)) } },
    });
    const colors = new Map(categories.map((category) => [category.id, category.color]));
    return [...Map.groupBy(groups, (group) => group.startDate.getTime())].map(([time, rows]) => ({
      date: new Date(time),
      total: sumBy(rows, (row) => row.count),
      completed: sumBy(rows, (row) => (row.completed ? row.count : 0)),
      categoryColors: uniq(
        rows.flatMap((row) => {
          const color = colors.get(row.categoryId);
          return color == null ? [] : [color];
        }),
      ),
    }));
  }
}
