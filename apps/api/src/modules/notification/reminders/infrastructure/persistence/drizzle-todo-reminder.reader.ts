import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { uniq } from "es-toolkit";

import {
  openReminderTodos,
  type TodoId,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port.js";
import type { ActiveTodoReadModel } from "../../application/read-models/scheduler.read-model.js";

@Injectable()
export class DrizzleTodoReminderReader implements TodoReminderReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findActiveTodos(
    todoIds: readonly TodoId[],
  ): Promise<ReadonlyMap<number, ActiveTodoReadModel>> {
    if (todoIds.length === 0) {
      return new Map();
    }
    const targets = openReminderTodos(uniq(todoIds.map((todoId) => todoId.value)));
    const rows = await this.#db.select().from(targets);
    return new Map(
      rows.map(({ scheduledTime, ...rest }) => [
        rest.id,
        { ...rest, startDate: rest.startDate.toString(), scheduledAt: scheduledTime },
      ]),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
