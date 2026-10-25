import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { decodeRecord } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type {
  NotificationTodoTarget,
  NotificationTodoTargetReaderPort,
} from "../../../application/ports/delivery/notification-todo-target.reader.port.js";

@Injectable()
export class PrismaNotificationTodoTargetReader implements NotificationTodoTargetReaderPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async findTodoTargets(
    todoIds: readonly number[],
  ): Promise<ReadonlyMap<number, NotificationTodoTarget>> {
    if (todoIds.length === 0) {
      return new Map();
    }

    const rows = decodeRecord(
      "Todo",
      await this.txHost.tx.orm.public.Todo.where((row) => row.id.in([...todoIds]))
        .select("id", "userId", "startDate")
        .all(),
    );

    return new Map(
      rows.map((row) => [row.id, { ownerId: row.userId, date: toDateString(row.startDate) }]),
    );
  }
}
