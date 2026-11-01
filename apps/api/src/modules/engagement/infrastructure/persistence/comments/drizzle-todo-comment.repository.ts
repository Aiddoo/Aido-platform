import { createHash } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  isUniqueConstraintViolation,
  requireRecord,
  uniqueConstraintTargets,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoComment, todoCommentLike, todoView } from "#api/platform/database/schema/index";
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
import { TodoCommentId } from "../../../domain/value-objects/comments/todo-comment-id.vo.js";

type CommentRow = typeof todoComment.$inferSelect;
type ReplayRow = Pick<
  CommentRow,
  "id" | "todoId" | "authorId" | "parentId" | "clientRequestId" | "requestFingerprint" | "content"
>;

const chainComment = alias(todoComment, "comment");

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
    rootId: row.rootId,
    path: row.path,
    content: row.content,
    deletedAt: row.deletedAt,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
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
    const expectedParentId = index === 0 ? command.parentId : previous?.id;
    const item = command.items[index];

    return (
      item != null &&
      // nullish-strict: undefined는 목록 밖 항목, null은 루트 댓글의 부모다
      expectedParentId !== undefined &&
      row.todoId === command.todoId &&
      row.authorId === command.authorId &&
      row.parentId === expectedParentId &&
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
        parentId: true,
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

  /** 글마다 부모가 바로 앞 글이라 insert는 순차지만, 응답 projection은 reader가 한 번에 hydrate한다. */
  async createCommentChain(
    input: CreateTodoCommentChainInput,
  ): Promise<TodoCommentChainCreationResult> {
    const requestFingerprint = commentCommandFingerprint({
      todoId: input.todoId,
      authorId: input.authorId,
      parentId: input.placement.parentId?.getValue() ?? null,
      items: input.items,
    });
    let placement = input.placement;
    const commentIds: string[] = [];
    const lastIndex = input.items.length - 1;

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
            parentId: placement.parentId?.getValue() ?? null,
            rootId: placement.rootId?.getValue() ?? null,
            path: [...placement.path],
            depth: placement.depth,
            replyCount: index < lastIndex ? 1 : 0,
          })
          .returning({ id: todoComment.id });
        const created = requireRecord(row);

        commentIds.push(created.id);
        placement = placement.under(TodoCommentId.create(created.id));
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
          eq(todoComment.authorId, comment.authorId),
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

  async incrementReplyCount(parentId: string): Promise<boolean> {
    const updated = await this.db
      .update(todoComment)
      .set({ replyCount: sql`${todoComment.replyCount} + ${1}` })
      .where(and(eq(todoComment.id, parentId), isNull(todoComment.deletedAt)))
      .returning({ id: todoComment.id });

    return updated.length === 1;
  }

  async dropDeletedFromAncestors(commentId: string, path: readonly string[]): Promise<void> {
    const chain = [commentId, ...[...path].reverse()];
    const commentIds = sql.join(
      chain.map((id) => sql`${id}`),
      sql`, `,
    );

    // 방금 삭제한 행이 화면에서 사라질 때만 부모의 표시 가능한 직계 답글 수를 내린다.
    // 삭제된 부모가 마지막 자식을 잃으면 같은 규칙을 조상까지 이어 가되, 깊이마다 왕복하지 않는다.
    await this.db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT item."commentId", item."ordinal"::INTEGER
        FROM unnest(ARRAY[${commentIds}]::TEXT[])
          WITH ORDINALITY AS item("commentId", "ordinal")
      ),
      invisible AS (
        SELECT chain."commentId", chain."ordinal"
        FROM chain
        INNER JOIN ${todoComment} AS ${chainComment} ON ${chainComment.id} = chain."commentId"
        WHERE chain."ordinal" = 1
          AND ${chainComment.deletedAt} IS NOT NULL
          AND ${chainComment.replyCount} = 0

        UNION ALL

        SELECT chain."commentId", chain."ordinal"
        FROM invisible AS child
        INNER JOIN chain ON chain."ordinal" = child."ordinal" + 1
        INNER JOIN ${todoComment} AS ${chainComment} ON ${chainComment.id} = chain."commentId"
        WHERE ${chainComment.deletedAt} IS NOT NULL
          AND ${chainComment.replyCount} = 1
      ),
      parents_to_decrement AS (
        SELECT parent."commentId"
        FROM invisible AS child
        INNER JOIN chain AS parent ON parent."ordinal" = child."ordinal" + 1
      )
      UPDATE ${todoComment}
      SET ${sql.identifier(todoComment.replyCount.name)} = ${todoComment.replyCount} - 1,
        ${sql.identifier(todoComment.updatedAt.name)} = CURRENT_TIMESTAMP
      FROM parents_to_decrement AS target
      WHERE ${todoComment.id} = target."commentId"
        AND ${todoComment.replyCount} > 0
    `);
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
      columns: { id: true, authorId: true, rootId: true },
      where: {
        id: commentId,
        todoId,
        deletedAt: { isNull: true },
        likes: { userId, isActive: true, notifiedAt: { isNull: true } },
      },
    });
    return row == null ? null : { recipientId: row.authorId, threadRootId: row.rootId ?? row.id };
  }

  async markLikeNotified(commentId: string, userId: string): Promise<void> {
    const affected = await this.db
      .update(todoCommentLike)
      .set({ notifiedAt: new Date() })
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
