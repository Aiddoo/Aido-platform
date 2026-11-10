import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoView } from "#api/platform/database/schema/index";

import type {
  TodoEngagementCounterPort,
  TodoViewRecord,
} from "../../application/ports/todo-engagement-counter.port.js";

// 숫자 칸만 바꾸는 집합 update라 Todo의 updatedAt은 스키마 $onUpdate가 지금처럼 함께 바꾼다
@Injectable()
export class DrizzleTodoEngagementCounterAdapter implements TodoEngagementCounterPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async increaseCommentCount(todoId: number, amount: number): Promise<void> {
    const [row] = await this.#db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} + ${amount}` })
      .where(eq(todo.id, todoId))
      .returning({ id: todo.id });
    requireRecord(row);
  }

  async decrementCommentCount(todoId: number): Promise<boolean> {
    const changed = await this.#db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} - ${1}` })
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
        .set({ viewCount: sql`${todo.viewCount} + ${1}` })
        .where(eq(todo.id, todoId))
        .returning({ viewCount: todo.viewCount });
      return { recorded: true, viewCount: requireRecord(updated).viewCount };
    }
    const existing = requireRecord(
      await this.#db.query.todo.findFirst({ columns: { viewCount: true }, where: { id: todoId } }),
    );
    return { recorded: false, viewCount: existing.viewCount };
  }
}
