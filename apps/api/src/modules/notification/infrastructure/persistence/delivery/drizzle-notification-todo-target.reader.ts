import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type {
  NotificationTodoTarget,
  NotificationTodoTargetReaderPort,
} from "../../../application/ports/delivery/notification-todo-target.reader.port.js";

@Injectable()
export class DrizzleNotificationTodoTargetReader implements NotificationTodoTargetReaderPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async findTodoTargets(
    todoIds: readonly number[],
  ): Promise<ReadonlyMap<number, NotificationTodoTarget>> {
    if (todoIds.length === 0) {
      return new Map();
    }

    const rows = await this.txHost.tx.query.todo.findMany({
      columns: { id: true, userId: true, startDate: true },
      where: { id: { in: [...todoIds] } },
    });

    return new Map(
      rows.map((row) => [row.id, { ownerId: row.userId, date: toDateString(row.startDate) }]),
    );
  }
}
