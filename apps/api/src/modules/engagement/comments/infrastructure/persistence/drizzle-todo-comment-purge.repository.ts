import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { TodoCommentCount } from "#api/modules/planning/todos/planning-todos.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  todoComment as todoCommentTable,
  todoCommentLike as todoCommentLikeTable,
} from "#api/platform/database/schema/engagement.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type TodoCommentPurgePlan,
  TodoCommentPurgeRepositoryPort,
} from "../../application/ports/todo-comment-purge.repository.port.js";
import { DELETED_COMMENT_AUTHOR } from "../../domain/comments.constants.js";

interface CounterChange {
  readonly id: string;
  readonly value: number;
}

// 바꿀 행이 여러 개라 UPDATE … FROM (VALUES …) 한 문장으로 쓴다
function valuesOf(changes: readonly CounterChange[]): SQL {
  const rows = changes.map(({ id, value }) => sql`(${id}, ${value}::integer)`);
  return sql`(values ${sql.join(rows, sql`, `)}) as desired("id", "value")`;
}

@Injectable()
export class DrizzleTodoCommentPurgeRepository implements TodoCommentPurgeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  /** 잠금 순서를 계획과 정리에서 같게 두려고 글 id 오름차순으로 고정한다 */
  #commentsOf(todoIds: readonly number[]) {
    return this.#db
      .select({ id: todoCommentTable.id })
      .from(todoCommentTable)
      .where(inArray(todoCommentTable.todoId, [...todoIds]))
      .orderBy(asc(todoCommentTable.id));
  }

  async planPurge(userId: UserId): Promise<TodoCommentPurgePlan> {
    const likedByUser = this.#db
      .select({ commentId: todoCommentLikeTable.commentId })
      .from(todoCommentLikeTable)
      .where(
        and(
          eq(todoCommentLikeTable.commentId, todoCommentTable.id),
          eq(todoCommentLikeTable.userId, userId.value),
        ),
      );
    const affectedTodoRows = await this.#db
      .selectDistinct({ todoId: todoCommentTable.todoId })
      .from(todoCommentTable)
      .where(or(eq(todoCommentTable.authorId, userId.value), exists(likedByUser)))
      .orderBy(asc(todoCommentTable.todoId));
    const affectedTodoIds = affectedTodoRows.map((row) => row.todoId);
    if (affectedTodoIds.length === 0) {
      return { affectedTodoIds: [], commentIdsToLock: [] };
    }
    const commentRows = await this.#commentsOf(affectedTodoIds);
    return { affectedTodoIds, commentIdsToLock: commentRows.map((row) => row.id) };
  }

  async purge(
    userId: UserId,
    plan: TodoCommentPurgePlan,
    now: Temporal.Instant,
  ): Promise<TodoCommentCount[]> {
    if (plan.affectedTodoIds.length === 0) {
      return [];
    }
    const todoIds = [...plan.affectedTodoIds];
    await this.#commentsOf(todoIds).for("update");

    // 지울 사용자의 꺼진 좋아요도 FK를 잡고 있어 모두 지운다. 남은 좋아요 수는 아래에서 실제 행으로 다시 센다
    await this.#db
      .delete(todoCommentLikeTable)
      .where(eq(todoCommentLikeTable.userId, userId.value));
    const authored = this.#db
      .select({ id: todoCommentTable.id })
      .from(todoCommentTable)
      .where(eq(todoCommentTable.authorId, userId.value));
    await this.#db
      .update(todoCommentLikeTable)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(todoCommentLikeTable.isActive, true),
          inArray(todoCommentLikeTable.commentId, authored),
        ),
      );
    // 물리 삭제 대신 묘비를 남겨 다른 작성자의 답글이 묶음에 남게 한다. 이미 지운 글의 삭제 시각은 그대로 둔다
    await this.#db
      .update(todoCommentTable)
      .set({ deletedAt: now })
      .where(and(eq(todoCommentTable.authorId, userId.value), isNull(todoCommentTable.deletedAt)));
    await this.#db
      .update(todoCommentTable)
      .set({ content: null, likeCount: 0, updatedAt: now })
      .where(eq(todoCommentTable.authorId, userId.value));

    await this.#reconcileCounters(todoIds, now);
    await this.#handOverToDeletedAuthor(userId, now);
    return this.#countVisibleComments(todoIds);
  }

  /** 좋아요 수는 켜진 좋아요 행, 묶음 머리의 답글 수는 지워지지 않은 답글 행으로 다시 센다 */
  async #reconcileCounters(todoIds: readonly number[], now: Temporal.Instant): Promise<void> {
    const comments = await this.#db
      .select({
        id: todoCommentTable.id,
        parentId: todoCommentTable.parentId,
        likeCount: todoCommentTable.likeCount,
        replyCount: todoCommentTable.replyCount,
      })
      .from(todoCommentTable)
      .where(inArray(todoCommentTable.todoId, [...todoIds]));
    const activeLikes = await this.#db
      .select({ commentId: todoCommentLikeTable.commentId, likeCount: count() })
      .from(todoCommentLikeTable)
      .innerJoin(todoCommentTable, eq(todoCommentTable.id, todoCommentLikeTable.commentId))
      .where(
        and(
          inArray(todoCommentTable.todoId, [...todoIds]),
          eq(todoCommentLikeTable.isActive, true),
        ),
      )
      .groupBy(todoCommentLikeTable.commentId);
    const visibleReplies = await this.#db
      .select({ threadCommentId: todoCommentTable.parentId, replyCount: count() })
      .from(todoCommentTable)
      .where(
        and(
          inArray(todoCommentTable.todoId, [...todoIds]),
          isNotNull(todoCommentTable.parentId),
          isNull(todoCommentTable.deletedAt),
        ),
      )
      .groupBy(todoCommentTable.parentId);

    const likeCounts = new Map(activeLikes.map((row) => [row.commentId, row.likeCount]));
    const replyCounts = new Map(visibleReplies.map((row) => [row.threadCommentId, row.replyCount]));
    const likeChanges = comments.flatMap((comment) => {
      const value = likeCounts.get(comment.id) ?? 0;
      return value === comment.likeCount ? [] : [{ id: comment.id, value }];
    });
    const replyChanges = comments.flatMap((comment) => {
      const value = replyCounts.get(comment.id) ?? 0;
      return comment.parentId != null || value === comment.replyCount
        ? []
        : [{ id: comment.id, value }];
    });

    if (likeChanges.length > 0) {
      await this.#db
        .update(todoCommentTable)
        .set({ likeCount: sql`desired."value"`, updatedAt: now })
        .from(valuesOf(likeChanges))
        .where(eq(todoCommentTable.id, sql`desired."id"`));
    }
    if (replyChanges.length > 0) {
      await this.#db
        .update(todoCommentTable)
        .set({ replyCount: sql`desired."value"`, updatedAt: now })
        .from(valuesOf(replyChanges))
        .where(eq(todoCommentTable.id, sql`desired."id"`));
    }
  }

  /**
   * 마지막에 개인정보가 없는 시스템 작성자로 넘긴다. nullable 작성자를 모르는 직전 API로 롤백해도 관계가 깨지지 않는다.
   * 여기까지 오지 못하면 RESTRICT FK가 hard delete를 막아 반쪽 정리를 허용하지 않는다.
   * 다른 사용자가 같은 멱등 키를 쓴 글과 겹치지 않도록 멱등 키를 새로 만든다.
   */
  async #handOverToDeletedAuthor(userId: UserId, now: Temporal.Instant): Promise<void> {
    const authored = await this.#db
      .select({ id: todoCommentTable.id })
      .from(todoCommentTable)
      .where(eq(todoCommentTable.authorId, userId.value));
    if (authored.length === 0) {
      return;
    }
    const rows = authored.map(({ id }) => sql`(${id}, ${randomUUID()}::uuid)`);
    await this.#db
      .update(todoCommentTable)
      .set({
        authorId: DELETED_COMMENT_AUTHOR.id,
        clientRequestId: sql`handover."clientRequestId"`,
        requestFingerprint: null,
        updatedAt: now,
      })
      .from(sql`(values ${sql.join(rows, sql`, `)}) as handover("id", "clientRequestId")`)
      .where(eq(todoCommentTable.id, sql`handover."id"`));
  }

  async #countVisibleComments(todoIds: readonly number[]): Promise<TodoCommentCount[]> {
    const rows = await this.#db
      .select({ todoId: todoCommentTable.todoId, commentCount: count() })
      .from(todoCommentTable)
      .where(
        and(inArray(todoCommentTable.todoId, [...todoIds]), isNull(todoCommentTable.deletedAt)),
      )
      .groupBy(todoCommentTable.todoId);
    const counts = new Map(rows.map((row) => [row.todoId, row.commentCount]));
    return todoIds.map((todoId) => ({ todoId, commentCount: counts.get(todoId) ?? 0 }));
  }
}
