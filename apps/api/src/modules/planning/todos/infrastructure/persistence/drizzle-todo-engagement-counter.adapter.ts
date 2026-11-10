import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoView } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  TodoCommentCount,
  TodoEngagementCounterPort,
  TodoViewRecord,
} from "../../application/ports/todo-engagement-counter.port.js";

// 숫자 칸만 바꾸는 update도 지금처럼 Todo의 updatedAt을 ClockPort 값으로 함께 바꾼다
@Injectable()
export class DrizzleTodoEngagementCounterAdapter implements TodoEngagementCounterPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async increaseCommentCount(todoId: number, amount: number): Promise<void> {
    const [row] = await this.#db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} + ${amount}`, updatedAt: this.#clock.now() })
      .where(eq(todo.id, todoId))
      .returning({ id: todo.id });
    requireRecord(row);
  }

  async decrementCommentCount(todoId: number): Promise<boolean> {
    const changed = await this.#db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} - ${1}`, updatedAt: this.#clock.now() })
      .where(and(eq(todo.id, todoId), gt(todo.commentCount, 0)))
      .returning({ id: todo.id });
    return changed.length === 1;
  }

  async recordView(todoId: number, viewerId: string): Promise<TodoViewRecord> {
    const inserted = await this.#db
      .insert(todoView)
      .values({ todoId, viewerId })
      .onConflictDoNothing()
      .returning({ todoId: todoView.todoId });
    if (inserted.length === 1) {
      const [updated] = await this.#db
        .update(todo)
        .set({ viewCount: sql`${todo.viewCount} + ${1}`, updatedAt: this.#clock.now() })
        .where(eq(todo.id, todoId))
        .returning({ viewCount: todo.viewCount });
      return { recorded: true, viewCount: requireRecord(updated).viewCount };
    }
    const existing = requireRecord(
      await this.#db.query.todo.findFirst({ columns: { viewCount: true }, where: { id: todoId } }),
    );
    return { recorded: false, viewCount: existing.viewCount };
  }

  async lockCounters(todoIds: readonly number[]): Promise<void> {
    if (todoIds.length === 0) {
      return;
    }
    await this.#db
      .select({ id: todo.id })
      .from(todo)
      .where(inArray(todo.id, [...todoIds]))
      .orderBy(asc(todo.id))
      .for("update");
  }

  async replaceCommentCounts(counts: readonly TodoCommentCount[]): Promise<void> {
    if (counts.length === 0) {
      return;
    }
    const rows = sql.join(
      counts.map(({ todoId, commentCount }) => sql`(${todoId}::integer, ${commentCount}::integer)`),
      sql`, `,
    );
    const desired = sql`(values ${rows}) as desired("todoId", "commentCount")`;
    await this.#db
      .update(todo)
      .set({ commentCount: sql`desired."commentCount"`, updatedAt: this.#clock.now() })
      .from(desired)
      .where(
        and(eq(todo.id, sql`desired."todoId"`), ne(todo.commentCount, sql`desired."commentCount"`)),
      );
  }
}
