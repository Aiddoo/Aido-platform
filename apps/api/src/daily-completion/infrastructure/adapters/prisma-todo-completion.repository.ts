import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";
import { groupBy, sumBy } from "es-toolkit";

import { decodeRecord } from "#api/shared/infrastructure/database/database-records";
import { applicationDate, databaseDate } from "#api/shared/infrastructure/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
  AggregateByDateRangeParams,
  TodoCompletionRepositoryPort,
} from "../../application/ports/todo-completion.repository.port.js";
import type { TodoAggregateByDate } from "../../domain/daily-completion.js";

/** Aggregate counts and distinct categories in PostgreSQL, then load each category once. */
@Injectable()
export class PrismaTodoCompletionRepository implements TodoCompletionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

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
    const client = this.txHost.tx;
    const groups = await client.orm.public.Todo.where((todo) =>
      and(
        todo.userId.eq(params.userId),
        todo.startDate.gte(databaseDate(params.startDate)),
        todo.startDate.lt(databaseDate(params.endDate)),
        publicOnly ? todo.visibility.eq("PUBLIC") : all(),
      ),
    )
      .groupBy("startDate", "categoryId", "completed")
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    if (groups.length === 0) return [];

    const categories = decodeRecord(
      "TodoCategory",
      await client.orm.public.TodoCategory.where((category) =>
        category.id.in([...new Set(groups.map((group) => group.categoryId))]),
      )
        .select("id", "color")
        .all(),
    );
    const colors = new Map(categories.map((category) => [category.id, category.color]));
    return Object.entries(groupBy(groups, (group) => group.startDate)).map(([date, rows]) => ({
      date: applicationDate(date),
      total: sumBy(rows, (row) => row.count),
      completed: sumBy(rows, (row) => (row.completed ? row.count : 0)),
      categoryColors: [
        ...new Set(
          rows.flatMap((row) => {
            const color = colors.get(row.categoryId);
            return color === undefined ? [] : [color];
          }),
        ),
      ],
    }));
  }
}
