import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type {
  NotificationTodoTarget,
  NotificationTodoTargetReaderPort,
} from "../../application/ports/notification-todo-target.reader.port.js";

@Injectable()
export class DrizzleNotificationTodoTargetReader implements NotificationTodoTargetReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async findTodoTargets(
    todoIds: readonly TodoId[],
  ): Promise<ReadonlyMap<number, NotificationTodoTarget>> {
    if (todoIds.length === 0) {
      return new Map();
    }

    const rows = await this.#txHost.tx.query.todo.findMany({
      columns: { id: true, userId: true, startDate: true },
      where: { id: { in: todoIds.map((todoId) => todoId.value) } },
    });

    return new Map(
      rows.map((row) => [row.id, { ownerId: row.userId, date: row.startDate.toString() }]),
    );
  }
}
