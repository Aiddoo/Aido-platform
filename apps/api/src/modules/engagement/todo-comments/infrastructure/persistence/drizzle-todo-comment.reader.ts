import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { userDisplayProfiles } from "#api/modules/identity/users/identity-users-queries.public";
import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentReaderPort } from "../../application/ports/todo-comment.reader.port.js";
import type { TodoCommentReadModel } from "../../application/read-models/todo-comment.read-model.js";
import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import {
  anchorComment,
  commentAuthor,
  columnsOf,
  commentTodo,
  projectionOf,
  replyTarget,
  replyTargetAuthor,
  requireTodoCommentReadModel,
  toDisplayName,
} from "./todo-comment-read-model.mapper.js";

@Injectable()
export class DrizzleTodoCommentReader implements TodoCommentReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async findComment(
    todoId: TodoId,
    commentId: TodoCommentId,
  ): Promise<TodoCommentReadModel | null> {
    const [comment] = await this.listComments(todoId, [commentId]);
    return comment ?? null;
  }

  async listComments(
    todoId: TodoId,
    commentIds: readonly TodoCommentId[],
  ): Promise<TodoCommentReadModel[]> {
    if (commentIds.length === 0) {
      return [];
    }
    const ids = commentIds.map((commentId) => commentId.value);
    const source = columnsOf(anchorComment);
    const rows = await this.#db
      .select(projectionOf(source))
      .from(anchorComment)
      .leftJoin(commentTodo, eq(commentTodo.todoId, source.todoId))
      .leftJoin(commentAuthor, eq(commentAuthor.userId, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetAuthor, eq(replyTargetAuthor.userId, replyTarget.authorId))
      .where(and(eq(anchorComment.todoId, todoId.value), inArray(anchorComment.id, ids)));
    const commentsById = new Map(
      rows.map((row) => [row.commentId, requireTodoCommentReadModel(row)]),
    );
    return ids.flatMap((commentId) => {
      const comment = commentsById.get(commentId);
      return comment == null ? [] : [comment];
    });
  }

  async findUserDisplayName(userId: UserId): Promise<string | null> {
    const display = userDisplayProfiles("display_name");
    const [found] = await this.#db
      .select({ userId: display.userId, name: display.name, userTag: display.userTag })
      .from(display)
      .where(eq(display.userId, userId.value))
      .limit(1);
    return found == null ? null : toDisplayName(found);
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
