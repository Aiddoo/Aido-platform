import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lte } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";

import {
  type SingleTodoCountQuery,
  SingleTodoCountReaderPort,
} from "../../application/ports/single-todo-count.reader.port.js";

@Injectable()
export class DrizzleSingleTodoCountReader implements SingleTodoCountReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  countSingleTodos(query: SingleTodoCountQuery): Promise<number> {
    return this.#txHost.tx.$count(
      todo,
      and(
        eq(todo.userId, query.userId.value),
        isNull(todo.seriesId),
        gte(todo.startDate, query.from),
        lte(todo.startDate, query.to),
      ),
    );
  }
}
