import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  isUniqueConstraintViolation,
  requireRecord,
  uniqueConstraintTargets,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoComment, todoCommentLike, todoView } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/index";

import type {
  CreateTodoCommentChainInput,
  TodoCommentChainCommand,
  TodoCommentChainCreationResult,
  TodoCommentLikeTransition,
} from "../../../application/models/comments/todo-comment.types.js";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
  type TodoCommentRepositoryPort,
} from "../../../application/ports/comments/todo-comment.repository.port.js";
import { TodoComment } from "../../../domain/aggregates/comments/todo-comment.aggregate.js";
import { CommentPlacement } from "../../../domain/value-objects/comments/comment-placement.vo.js";

type CommentRow = typeof todoComment.$inferSelect;
type ReplayRow = Pick<
  CommentRow,
  | "id"
  | "todoId"
  | "authorId"
  | "replyToCommentId"
  | "clientRequestId"
  | "requestFingerprint"
  | "content"
>;

function commentCommandFingerprint(input: TodoCommentChainCommand): string {
  const command = JSON.stringify({
    version: 1,
    todoId: input.todoId,
    authorId: input.authorId,
    parentId: input.parentId,
    items: input.items,
  });

  return createHash("sha256").update(command).digest("hex");
}

function toAggregate(row: CommentRow): TodoComment {
  return TodoComment.reconstitute({
    id: row.id,
    todoId: row.todoId,
    authorId: row.authorId,
    parentId: row.parentId,
    replyToCommentId: row.replyToCommentId,
    content: row.content,
    replyCount: row.replyCount,
    deletedAt: row.deletedAt,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toStoredPlacement(placement: CommentPlacement) {
  if (placement.kind === "COMMENT") {
    return { parentId: null, replyToCommentId: null };
  }

  return {
    parentId: placement.threadCommentId,
    replyToCommentId: placement.replyToCommentId,
  };
}

function orderReplayRows(
  rows: readonly ReplayRow[],
  command: TodoCommentChainCommand,
): ReplayRow[] {
  const rowsByRequestId = new Map(rows.map((row) => [row.clientRequestId, row]));
  const ordered = command.items.flatMap((item) => {
    const row = rowsByRequestId.get(item.clientRequestId);
    return row == null ? [] : [row];
  });

  if (
    ordered.length !== command.items.length ||
    rows.length !== command.items.length ||
    new Set(command.items.map((item) => item.clientRequestId)).size !== command.items.length
  ) {
    throw new TodoCommentIdempotencyConflict();
  }

  return ordered;
}

function isLegacyReplay(ordered: readonly ReplayRow[], command: TodoCommentChainCommand): boolean {
  return ordered.every((row, index) => {
    const previous = ordered[index - 1];
    const expectedReplyToId = index === 0 ? command.parentId : previous?.id;
    const item = command.items[index];

    return (
      item != null &&
      // nullish-strict: undefined는 목록 밖 항목, null은 할 일에 단 댓글이다
      expectedReplyToId !== undefined &&
      row.todoId === command.todoId &&
      row.authorId === command.authorId &&
      row.replyToCommentId === expectedReplyToId &&
      row.content === item.content
    );
  });
}

function isIdempotencyRace(error: unknown): boolean {
  if (!isUniqueConstraintViolation(error)) {
    return false;
  }

  const targets = uniqueConstraintTargets(error);
  if (targets == null) {
    // PostgreSQL unique 오류의 constraint 이름으로 멱등성 충돌을 식별한다.
    // 이 insert의 id는 DB가 만들고, 유일한 업무 유니크는 authorId/clientRequestId다.
    return true;
  }

  return targets.includes("authorId") && targets.includes("clientRequestId");
}

@Injectable()
export class DrizzleTodoCommentRepository implements TodoCommentRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findComment(todoId: number, commentId: string): Promise<TodoComment | null> {
    const row = await this.db.query.todoComment.findFirst({
      where: { id: commentId, todoId },
    });

    return row == null ? null : toAggregate(row);
  }

  async findCommentChainReplay(input: TodoCommentChainCommand): Promise<string[] | null> {
    const clientRequestIds = input.items.map((item) => item.clientRequestId);
    const requestFingerprint = commentCommandFingerprint(input);
    const existing = await this.db.query.todoComment.findMany({
      columns: {
        id: true,
        todoId: true,
        authorId: true,
        replyToCommentId: true,
        clientRequestId: true,
        requestFingerprint: true,
        content: true,
      },
      where: { authorId: input.authorId, clientRequestId: { in: clientRequestIds } },
    });

    if (existing.length === 0) {
      return null;
    }

    const ordered = orderReplayRows(existing, input);
    const allCurrent = ordered.every((row) => row.requestFingerprint === requestFingerprint);
    if (allCurrent) {
      return ordered.map((row) => row.id);
    }

    const allLegacy = ordered.every((row) => row.requestFingerprint == null);
    if (allLegacy && isLegacyReplay(ordered, input)) {
      return ordered.map((row) => row.id);
    }

    throw new TodoCommentIdempotencyConflict();
  }

  /**
   * 이어 쓴 글은 모두 같은 묶음에 붙고 각자 바로 앞 글에 답한다. 답글 대상이 앞 글의 id라
   * insert는 순차지만, 응답 projection은 reader가 한 번에 hydrate한다.
   * 묶음 안 답글은 작성 시각 순서라 같은 트랜잭션 시각에 1ms씩 더해 쓴 순서를 남긴다.
   */
  async createCommentChain(
    input: CreateTodoCommentChainInput,
  ): Promise<TodoCommentChainCreationResult> {
    const requestFingerprint = commentCommandFingerprint({
      todoId: input.todoId,
      authorId: input.authorId,
      parentId: input.placement.kind === "COMMENT" ? null : input.placement.replyToCommentId,
      items: input.items,
    });
    let placement = input.placement;
    const commentIds: string[] = [];

    try {
      for (const [index, item] of input.items.entries()) {
        const [row] = await this.db
          .insert(todoComment)
          .values({
            todoId: input.todoId,
            authorId: input.authorId,
            clientRequestId: item.clientRequestId,
            requestFingerprint,
            content: item.content,
            ...toStoredPlacement(placement),
            replyCount: placement.kind === "COMMENT" ? input.items.length - 1 : 0,
            createdAt: sql`CURRENT_TIMESTAMP + ${index} * INTERVAL '1 millisecond'`,
          })
          .returning({ id: todoComment.id });
        const created = requireRecord(row);

        commentIds.push(created.id);
        placement = CommentPlacement.replyTo({ id: created.id, placement });
      }
    } catch (error) {
      if (isIdempotencyRace(error)) {
        throw new TodoCommentIdempotencyRace();
      }

      throw error;
    }

    return { commentIds, createdCount: commentIds.length };
  }

  async updateComment(comment: TodoComment): Promise<boolean> {
    const updated = await this.db
      .update(todoComment)
      .set({ content: comment.content, editedAt: comment.editedAt })
      .where(
        and(
          eq(todoComment.id, comment.id.getValue()),
          eq(todoComment.todoId, comment.todoId),
          eq(todoComment.authorId, comment.authorId),
          isNull(todoComment.deletedAt),
        ),
      )
      .returning({ id: todoComment.id });

    return updated.length === 1;
  }

  async deleteComment(comment: TodoComment): Promise<boolean> {
    const deleted = await this.db
      .update(todoComment)
      .set({ content: null, deletedAt: comment.deletedAt, likeCount: 0 })
      .where(
        and(
          eq(todoComment.id, comment.id.getValue()),
          eq(todoComment.todoId, comment.todoId),
          isNull(todoComment.deletedAt),
        ),
      )
      .returning({ id: todoComment.id });

    if (deleted.length !== 1) {
      return false;
    }

    await this.db
      .update(todoCommentLike)
      .set({ isActive: false })
      .where(
        and(
          eq(todoCommentLike.commentId, comment.id.getValue()),
          eq(todoCommentLike.isActive, true),
        ),
      );

    return true;
  }

  async increaseTodoCommentCount(todoId: number, amount: number): Promise<void> {
    const [row] = await this.db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} + ${amount}` })
      .where(eq(todo.id, todoId))
      .returning({ id: todo.id });
    requireRecord(row);
  }

  async decrementTodoCommentCount(todoId: number): Promise<boolean> {
    const changed = await this.db
      .update(todo)
      .set({ commentCount: sql`${todo.commentCount} - ${1}` })
      .where(and(eq(todo.id, todoId), gt(todo.commentCount, 0)))
      .returning({ id: todo.id });

    return changed.length === 1;
  }

  async increaseReplyCount(commentId: string, amount: number): Promise<boolean> {
    const updated = await this.db
      .update(todoComment)
      .set({ replyCount: sql`${todoComment.replyCount} + ${amount}` })
      .where(and(eq(todoComment.id, commentId), isNull(todoComment.parentId)))
      .returning({ id: todoComment.id });

    return updated.length === 1;
  }

  async decreaseReplyCount(commentId: string): Promise<boolean> {
    const updated = await this.db
      .update(todoComment)
      .set({ replyCount: sql`${todoComment.replyCount} - ${1}` })
      .where(
        and(
          eq(todoComment.id, commentId),
          isNull(todoComment.parentId),
          gt(todoComment.replyCount, 0),
        ),
      )
      .returning({ id: todoComment.id });

    return updated.length === 1;
  }

  async setLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    const comment = requireRecord(
      await this.db.query.todoComment.findFirst({
        columns: { authorId: true, likeCount: true },
        where: { id: commentId, todoId },
      }),
    );
    const existingLike = await this.db.query.todoCommentLike.findFirst({
      where: { commentId, userId },
    });

    if (existingLike != null && existingLike.isActive) {
      return {
        commentId,
        commentAuthorId: comment.authorId,
        changed: false,
        isLiked: true,
        likeCount: comment.likeCount,
        wasEverNotified: existingLike.notifiedAt != null,
      };
    }

    const changed =
      existingLike != null
        ? await this.db
            .update(todoCommentLike)
            .set({ isActive: true })
            .where(
              and(
                eq(todoCommentLike.commentId, commentId),
                eq(todoCommentLike.userId, userId),
                eq(todoCommentLike.isActive, false),
              ),
            )
            .returning({ commentId: todoCommentLike.commentId })
        : await this.db
            .insert(todoCommentLike)
            .values({ commentId, userId, isActive: true })
            .onConflictDoNothing()
            .returning({ commentId: todoCommentLike.commentId });

    if (changed.length !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const [counter] = await this.db
      .update(todoComment)
      .set({ likeCount: sql`${todoComment.likeCount} + ${1}` })
      .where(
        and(
          eq(todoComment.id, commentId),
          eq(todoComment.todoId, todoId),
          isNull(todoComment.deletedAt),
        ),
      )
      .returning({ likeCount: todoComment.likeCount });
    if (counter == null) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    return {
      commentId,
      commentAuthorId: comment.authorId,
      changed: true,
      isLiked: true,
      likeCount: counter.likeCount,
      wasEverNotified: existingLike != null && existingLike.notifiedAt != null,
    };
  }

  async findPendingLikeNotification(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<{ readonly recipientId: string; readonly threadRootId: string } | null> {
    const row = await this.db.query.todoComment.findFirst({
      columns: { id: true, authorId: true, parentId: true },
      where: {
        id: commentId,
        todoId,
        deletedAt: { isNull: true },
        likes: { userId, isActive: true, notifiedAt: { isNull: true } },
      },
    });
    return row == null ? null : { recipientId: row.authorId, threadRootId: row.parentId ?? row.id };
  }

  async markLikeNotified(commentId: string, userId: string): Promise<void> {
    const affected = await this.db
      .update(todoCommentLike)
      .set({ notifiedAt: now() })
      .where(
        and(
          eq(todoCommentLike.commentId, commentId),
          eq(todoCommentLike.userId, userId),
          eq(todoCommentLike.isActive, true),
          isNull(todoCommentLike.notifiedAt),
        ),
      )
      .returning({ commentId: todoCommentLike.commentId });
    if (affected.length !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }
  }

  async removeLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    const comment = requireRecord(
      await this.db.query.todoComment.findFirst({
        columns: { authorId: true, likeCount: true },
        where: { id: commentId, todoId },
      }),
    );
    const existingLike = await this.db.query.todoCommentLike.findFirst({
      where: { commentId, userId },
    });

    if (existingLike == null || !existingLike.isActive) {
      return {
        commentId,
        commentAuthorId: comment.authorId,
        changed: false,
        isLiked: false,
        likeCount: comment.likeCount,
        wasEverNotified: existingLike != null && existingLike.notifiedAt != null,
      };
    }

    const changed = await this.db
      .update(todoCommentLike)
      .set({ isActive: false })
      .where(
        and(
          eq(todoCommentLike.commentId, commentId),
          eq(todoCommentLike.userId, userId),
          eq(todoCommentLike.isActive, true),
        ),
      )
      .returning({ commentId: todoCommentLike.commentId });
    if (changed.length !== 1) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const [counter] = await this.db
      .update(todoComment)
      .set({ likeCount: sql`${todoComment.likeCount} - ${1}` })
      .where(
        and(
          eq(todoComment.id, commentId),
          eq(todoComment.todoId, todoId),
          isNull(todoComment.deletedAt),
          gt(todoComment.likeCount, 0),
        ),
      )
      .returning({ likeCount: todoComment.likeCount });
    if (counter == null) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }

    const like = await this.db.query.todoCommentLike.findFirst({
      columns: { notifiedAt: true },
      where: { commentId, userId },
    });

    return {
      commentId,
      commentAuthorId: comment.authorId,
      changed: true,
      isLiked: false,
      likeCount: counter.likeCount,
      wasEverNotified: like != null && like.notifiedAt != null,
    };
  }

  async recordView(
    todoId: number,
    viewerId: string,
  ): Promise<{ recorded: boolean; viewCount: number }> {
    const inserted = await this.db
      .insert(todoView)
      .values({ todoId, viewerId })
      .onConflictDoNothing()
      .returning({ todoId: todoView.todoId });

    if (inserted.length === 1) {
      const [updated] = await this.db
        .update(todo)
        .set({ viewCount: sql`${todo.viewCount} + ${1}` })
        .where(eq(todo.id, todoId))
        .returning({ viewCount: todo.viewCount });
      return { recorded: true, viewCount: requireRecord(updated).viewCount };
    }

    const existing = requireRecord(
      await this.db.query.todo.findFirst({ columns: { viewCount: true }, where: { id: todoId } }),
    );
    return { recorded: false, viewCount: existing.viewCount };
  }
}
