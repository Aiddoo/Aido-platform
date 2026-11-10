import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, lt } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/planning.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { ScheduledTodoReaderPort } from "../../application/ports/scheduled-todo.reader.port.js";
import type { ScheduledTodo } from "../../application/read-models/scheduled-todo.read-model.js";

/** planning의 todo 테이블에서 날씨 브리핑에 필요한 칸(id·시각)만 읽는다. */
@Injectable()
export class DrizzleScheduledTodoReader implements ScheduledTodoReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  async listPendingTimedTodos(params: {
    readonly userId: UserId;
    readonly from: Temporal.Instant;
    readonly until: Temporal.Instant;
  }): Promise<ScheduledTodo[]> {
    const rows = await this.#txHost.tx
      .select({ id: todo.id, scheduledTime: todo.scheduledTime })
      .from(todo)
      .where(
        and(
          eq(todo.userId, params.userId.value),
          eq(todo.isAllDay, false),
          eq(todo.completed, false),
          gte(todo.scheduledTime, instantToDate(params.from)),
          lt(todo.scheduledTime, instantToDate(params.until)),
        ),
      )
      .orderBy(asc(todo.scheduledTime), asc(todo.id));
    return rows.flatMap(({ id, scheduledTime }) =>
      scheduledTime == null ? [] : [{ id, scheduledAt: instantFromDate(scheduledTime) }],
    );
  }
}
