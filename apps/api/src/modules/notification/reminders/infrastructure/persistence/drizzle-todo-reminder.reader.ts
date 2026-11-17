import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { uniq } from "es-toolkit";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
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
    const rows = await this.#db.query.todo.findMany({
      columns: {
        id: true,
        title: true,
        seriesId: true,
        startDate: true,
        scheduledLocalTime: true,
        scheduledTime: true,
      },
      where: { id: { in: uniq(todoIds.map((todoId) => todoId.value)) }, completed: false },
    });
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
