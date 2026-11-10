import { randomUUID } from "node:crypto";

import {
  type TodoCommentPurgePlan,
  TodoCommentPurgeRepositoryPort,
} from "#api/modules/engagement/comments/application/ports/todo-comment-purge.repository.port";
import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import type { TodoCommentCount } from "#api/modules/planning/todos/planning-todos.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryTodoCommentLikeRepository } from "./in-memory-todo-comment-like.repository.js";
import type { InMemoryTodoCommentRepository } from "./in-memory-todo-comment.repository.js";

function byNumber(left: number, right: number): number {
  return left - right;
}

export class InMemoryTodoCommentPurgeRepository extends TodoCommentPurgeRepositoryPort {
  readonly #comments: InMemoryTodoCommentRepository;
  readonly #likes: InMemoryTodoCommentLikeRepository;

  constructor(comments: InMemoryTodoCommentRepository, likes: InMemoryTodoCommentLikeRepository) {
    super();
    this.#comments = comments;
    this.#likes = likes;
  }

  async planPurge(userId: UserId): Promise<TodoCommentPurgePlan> {
    const comments = this.#comments.list();
    const likedCommentIds = new Set(
      this.#likes
        .list()
        .filter((like) => like.userId.equals(userId))
        .map((like) => like.commentId.value),
    );
    const affectedTodoIds = [
      ...new Set(
        comments
          .filter(
            (comment) => comment.isAuthoredBy(userId) || likedCommentIds.has(comment.id.value),
          )
          .map((comment) => comment.todoId),
      ),
    ].toSorted(byNumber);
    const commentIdsToLock = comments
      .filter((comment) => affectedTodoIds.includes(comment.todoId))
      .map((comment) => comment.id.value)
      .toSorted();
    return { affectedTodoIds, commentIdsToLock };
  }

  async purge(
    userId: UserId,
    plan: TodoCommentPurgePlan,
    now: Temporal.Instant,
  ): Promise<TodoCommentCount[]> {
    if (plan.affectedTodoIds.length === 0) {
      return [];
    }
    this.#likes.removeByUserId(userId.value);
    for (const comment of this.#comments.list()) {
      if (comment.isAuthoredBy(userId)) {
        await this.#likes.deactivateAllByCommentId(comment.id, now);
      }
    }
    for (const comment of this.#comments.list()) {
      if (!comment.isAuthoredBy(userId)) {
        continue;
      }
      const stored = comment.toPrimitives();
      this.#comments.replace(
        TodoComment.reconstitute({
          ...stored,
          authorId: DELETED_COMMENT_AUTHOR.id,
          clientRequestId: randomUUID(),
          requestFingerprint: null,
          content: null,
          likeCount: 0,
          deletedAt: stored.deletedAt ?? now,
          updatedAt: now,
        }),
      );
    }
    const activeLikes = this.#likes.list().filter((like) => like.isActive);
    const tombstoned = this.#comments.list();
    for (const comment of tombstoned) {
      if (!plan.affectedTodoIds.includes(comment.todoId)) {
        continue;
      }
      const stored = comment.toPrimitives();
      const likeCount = activeLikes.filter((like) => like.commentId.equals(comment.id)).length;
      const replyCount = tombstoned.filter(
        (reply) => reply.isReply && reply.threadCommentId.equals(comment.id) && !reply.isDeleted,
      ).length;
      this.#comments.replace(
        TodoComment.reconstitute({
          ...stored,
          likeCount,
          replyCount: comment.isReply ? stored.replyCount : replyCount,
        }),
      );
    }
    const remaining = this.#comments.list();
    return plan.affectedTodoIds.map((todoId) => ({
      todoId,
      commentCount: remaining.filter((comment) => comment.todoId === todoId && !comment.isDeleted)
        .length,
    }));
  }
}
