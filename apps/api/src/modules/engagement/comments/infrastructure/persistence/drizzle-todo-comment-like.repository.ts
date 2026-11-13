import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoCommentLike as todoCommentLikeTable } from "#api/platform/database/schema/engagement.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentLikeRepositoryPort } from "../../application/ports/todo-comment-like.repository.port.js";
import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoCommentLike } from "../../domain/todo-comment-like.aggregate.js";
import { toTodoCommentLike, toTodoCommentLikeRow } from "./todo-comment-like-row.mapper.js";

@Injectable()
export class DrizzleTodoCommentLikeRepository implements TodoCommentLikeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByCommentIdAndUserId(
    commentId: TodoCommentId,
    userId: UserId,
  ): Promise<TodoCommentLike | null> {
    const row = await this.#db.query.todoCommentLike.findFirst({
      where: { commentId: commentId.value, userId: userId.value },
    });
    return row == null ? null : toTodoCommentLike(row);
  }

  async save(like: TodoCommentLike): Promise<void> {
    const row = toTodoCommentLikeRow(like);
    await this.#db
      .insert(todoCommentLikeTable)
      .values(row)
      .onConflictDoUpdate({
        target: [todoCommentLikeTable.commentId, todoCommentLikeTable.userId],
        set: { isActive: row.isActive, notifiedAt: row.notifiedAt, updatedAt: row.updatedAt },
      });
  }

  async unlikeAllByCommentId(commentId: TodoCommentId, now: Temporal.Instant): Promise<void> {
    await this.#db
      .update(todoCommentLikeTable)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(todoCommentLikeTable.commentId, commentId.value),
          eq(todoCommentLikeTable.isActive, true),
        ),
      );
  }
}
