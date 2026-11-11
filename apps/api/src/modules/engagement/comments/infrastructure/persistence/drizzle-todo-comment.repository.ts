import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { todoComment as todoCommentTable } from "#api/platform/database/schema/engagement.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentIdempotencyRace } from "../../application/comments.errors.js";
import { TodoCommentRepositoryPort } from "../../application/ports/todo-comment.repository.port.js";
import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoComment } from "../../domain/todo-comment.aggregate.js";
import { toTodoComment, toTodoCommentRow } from "./todo-comment-row.mapper.js";

const CLIENT_REQUEST_UNIQUE_CONSTRAINT = "TodoComment_authorId_clientRequestId_key";

@Injectable()
export class DrizzleTodoCommentRepository implements TodoCommentRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<TodoCommentId> {
    return TodoCommentId.reconstitute(createEntityId());
  }

  async findByIdAndTodoId(commentId: TodoCommentId, todoId: TodoId): Promise<TodoComment | null> {
    const row = await this.#db.query.todoComment.findFirst({
      where: { id: commentId.value, todoId: todoId.value },
    });
    return row == null ? null : toTodoComment(row);
  }

  async listByAuthorIdAndClientRequestIds(
    authorId: UserId,
    clientRequestIds: readonly string[],
  ): Promise<TodoComment[]> {
    if (clientRequestIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select()
      .from(todoCommentTable)
      .where(
        and(
          eq(todoCommentTable.authorId, authorId.value),
          inArray(todoCommentTable.clientRequestId, [...clientRequestIds]),
        ),
      );
    return rows.map(toTodoComment);
  }

  async save(comment: TodoComment): Promise<void> {
    const row = toTodoCommentRow(comment);
    try {
      await this.#db
        .insert(todoCommentTable)
        .values(row)
        .onConflictDoUpdate({
          target: todoCommentTable.id,
          set: {
            content: row.content,
            likeCount: row.likeCount,
            replyCount: row.replyCount,
            deletedAt: row.deletedAt,
            editedAt: row.editedAt,
            updatedAt: row.updatedAt,
          },
        });
    } catch (error) {
      // 같은 작성자의 멱등 키 유니크 위반은 동시에 같은 요청을 쓴 경합이다. 호출자가 먼저 쓴 글을 다시 읽는다
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === CLIENT_REQUEST_UNIQUE_CONSTRAINT
      ) {
        throw new TodoCommentIdempotencyRace();
      }
      throw error;
    }
  }
}
