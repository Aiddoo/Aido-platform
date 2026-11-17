import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import { TodoCommentReaderPort } from "../../application/ports/todo-comment.reader.port.js";
import type { TodoCommentReadModel } from "../../application/read-models/todo-comment.read-model.js";
import {
  anchorComment,
  authorProfile,
  authorUser,
  columnsOf,
  commentTodo,
  projectionOf,
  replyTarget,
  replyTargetProfile,
  replyTargetUser,
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
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .leftJoin(replyTargetUser, eq(replyTargetUser.id, replyTarget.authorId))
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
    const found = await this.#db.query.user.findFirst({
      columns: { id: true, userTag: true },
      with: { profile: { columns: { name: true } } },
      where: { id: userId.value },
    });
    return found == null
      ? null
      : toDisplayName({
          userId: found.id,
          name: found.profile?.name ?? null,
          userTag: found.userTag,
        });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
