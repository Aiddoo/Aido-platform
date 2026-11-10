import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoComment, todoCommentLike } from "#api/platform/database/schema/index";
import { DELETED_COMMENT_AUTHOR_ID } from "#api/shared/domain/system-user";

import type {
  TodoCommentPurgePlan,
  TodoCommentPurgeRepositoryPort,
} from "../../application/ports/todo-comment-purge.repository.port.js";

@Injectable()
export class DrizzleTodoCommentPurgeRepository implements TodoCommentPurgeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  /** 잠금 순서를 plan과 cleanup에서 같게 유지하도록 댓글 id 오름차순으로 고정한다. */
  #commentsOfTodos(todoIds: readonly number[]) {
    return this.#db
      .select({ id: todoComment.id })
      .from(todoComment)
      .where(inArray(todoComment.todoId, [...todoIds]))
      .orderBy(asc(todoComment.id));
  }

  async plan(userId: string): Promise<TodoCommentPurgePlan> {
    const affectedTodoRows = await this.#db
      .selectDistinct({ todoId: todoComment.todoId })
      .from(todoComment)
      .where(
        or(
          eq(todoComment.authorId, userId),
          exists(
            this.#db
              .select({ one: sql`1` })
              .from(todoCommentLike)
              .where(
                and(
                  eq(todoCommentLike.commentId, todoComment.id),
                  eq(todoCommentLike.userId, userId),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(todoComment.todoId));
    const affectedTodoIds = affectedTodoRows.map((row) => row.todoId);

    if (affectedTodoIds.length === 0) {
      return { affectedTodoIds: [], commentIdsToLock: [] };
    }

    const commentRows = await this.#commentsOfTodos(affectedTodoIds);

    return {
      affectedTodoIds,
      commentIdsToLock: commentRows.map((row) => row.id),
    };
  }

  async cleanup(userId: string, plan: TodoCommentPurgePlan): Promise<void> {
    if (plan.affectedTodoIds.length === 0) {
      return;
    }

    const todoIds = [...plan.affectedTodoIds];

    // 최상위 댓글 작성은 Todo.commentCount 행 잠금에서 합류합니다. 먼저 Todo를 잠그면
    // 절대값 재계산과 concurrent increment가 서로 덮어쓰지 않습니다.
    await this.#db
      .select({ id: todo.id })
      .from(todo)
      .where(inArray(todo.id, todoIds))
      .orderBy(asc(todo.id))
      .for("update");
    await this.#commentsOfTodos(todoIds).for("update");

    // purged user의 inactive like도 FK를 잡고 있으므로 모두 제거합니다. active likeCount는
    // 아래의 set-based reconciliation이 실제 남은 행을 기준으로 다시 확정합니다.
    await this.#db.delete(todoCommentLike).where(eq(todoCommentLike.userId, userId));
    await this.#db
      .update(todoCommentLike)
      .set({ isActive: false })
      .where(
        and(
          eq(todoCommentLike.isActive, true),
          inArray(
            todoCommentLike.commentId,
            this.#db
              .select({ id: todoComment.id })
              .from(todoComment)
              .where(eq(todoComment.authorId, userId)),
          ),
        ),
      );
    // 물리 삭제 대신 묘비를 남겨 다른 작성자의 답글이 묶음에 남게 합니다.
    await this.#db
      .update(todoComment)
      .set({
        content: null,
        deletedAt: sql`COALESCE(${todoComment.deletedAt}, CURRENT_TIMESTAMP)`,
        likeCount: 0,
      })
      .where(eq(todoComment.authorId, userId));

    const likeCounts = this.#db.$with("desired").as(
      this.#db
        .select({
          id: todoComment.id,
          likeCount:
            sql<number>`(count(${todoCommentLike.commentId}) filter (where ${todoCommentLike.isActive} = true))::integer`.as(
              "likeCount",
            ),
        })
        .from(todoComment)
        .leftJoin(todoCommentLike, eq(todoCommentLike.commentId, todoComment.id))
        .where(inArray(todoComment.todoId, todoIds))
        .groupBy(todoComment.id),
    );
    await this.#db
      .with(likeCounts)
      .update(todoComment)
      .set({ likeCount: sql`${likeCounts.likeCount}` })
      .from(likeCounts)
      .where(
        and(
          eq(todoComment.id, likeCounts.id),
          sql`${todoComment.likeCount} IS DISTINCT FROM ${likeCounts.likeCount}`,
        ),
      );

    // 묶음 머리 댓글의 답글 수는 지워지지 않은 답글 수입니다. 답글은 답글 수를 갖지 않습니다.
    const reply = alias(todoComment, "reply");
    const replyCounts = this.#db.$with("reply_counts").as(
      this.#db
        .select({
          id: todoComment.id,
          replyCount:
            sql<number>`(count(${reply.id}) filter (where ${reply.deletedAt} IS NULL))::integer`.as(
              "replyCount",
            ),
        })
        .from(todoComment)
        .leftJoin(reply, eq(reply.parentId, todoComment.id))
        .where(and(inArray(todoComment.todoId, todoIds), isNull(todoComment.parentId)))
        .groupBy(todoComment.id),
    );
    await this.#db
      .with(replyCounts)
      .update(todoComment)
      .set({ replyCount: sql`${replyCounts.replyCount}` })
      .from(replyCounts)
      .where(
        and(
          eq(todoComment.id, replyCounts.id),
          sql`${todoComment.replyCount} IS DISTINCT FROM ${replyCounts.replyCount}`,
        ),
      );

    const commentCounts = this.#db.$with("desired").as(
      this.#db
        .select({
          id: todo.id,
          commentCount:
            sql<number>`(count(${todoComment.id}) filter (where ${todoComment.deletedAt} IS NULL))::integer`.as(
              "commentCount",
            ),
        })
        .from(todo)
        .leftJoin(todoComment, eq(todoComment.todoId, todo.id))
        .where(inArray(todo.id, todoIds))
        .groupBy(todo.id),
    );
    await this.#db
      .with(commentCounts)
      .update(todo)
      .set({ commentCount: sql`${commentCounts.commentCount}` })
      .from(commentCounts)
      .where(
        and(
          eq(todo.id, commentCounts.id),
          sql`${todo.commentCount} IS DISTINCT FROM ${commentCounts.commentCount}`,
        ),
      );

    // 마지막에 개인정보가 없는 시스템 작성자로 옮깁니다. nullable author를 모르는 직전 API로
    // 롤백해도 relation 역참조가 깨지지 않고, 새 API는 deletedAt으로 묘비를 판정합니다.
    // 이 단계까지 가지 못하면 RESTRICT가 hard delete를 막아 반쪽 정리를 허용하지 않습니다.
    await this.#db
      .update(todoComment)
      .set({
        authorId: DELETED_COMMENT_AUTHOR_ID,
        clientRequestId: sql`gen_random_uuid()`,
        requestFingerprint: null,
      })
      .where(eq(todoComment.authorId, userId));
  }
}
