import { randomUUID } from "node:crypto";

import { TodoCommentId } from "#api/modules/engagement/shared/domain/todo-comment-id.vo";
import {
  type TodoCommentPurgePlan,
  TodoCommentPurgeRepositoryPort,
} from "#api/modules/engagement/todo-comments/application/ports/todo-comment-purge.repository.port";
import { TodoComment } from "#api/modules/engagement/todo-comments/domain/todo-comment.aggregate";
import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/todo-comments/domain/todo-comments.constants";
import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
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
          .map((comment) => comment.todoId.value),
      ),
    ].toSorted(byNumber);
    const commentIdsToLock = comments
      .filter((comment) => affectedTodoIds.includes(comment.todoId.value))
      .map((comment) => comment.id.value)
      .toSorted();
    return {
      affectedTodoIds: affectedTodoIds.map((todoId) => TodoId.reconstitute(todoId)),
      commentIdsToLock: commentIdsToLock.map((commentId) => TodoCommentId.reconstitute(commentId)),
    };
  }

  async purge(
    userId: UserId,
    plan: TodoCommentPurgePlan,
    now: Temporal.Instant,
  ): Promise<TodoCommentCount[]> {
    if (plan.affectedTodoIds.length === 0) {
      return [];
    }
    const affectedTodoIds = plan.affectedTodoIds.map((todoId) => todoId.value);
    this.#likes.removeByUserId(userId);
    for (const comment of this.#comments.list()) {
      if (comment.isAuthoredBy(userId)) {
        await this.#likes.unlikeAllByCommentId(comment.id, now);
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
    const activeLikes = this.#likes.list().filter((like) => like.isActive());
    const tombstoned = this.#comments.list();
    for (const comment of tombstoned) {
      if (!affectedTodoIds.includes(comment.todoId.value)) {
        continue;
      }
      const stored = comment.toPrimitives();
      const likeCount = activeLikes.filter((like) => like.commentId.equals(comment.id)).length;
      const replyCount = tombstoned.filter(
        (reply) =>
          reply.isReply() && reply.threadCommentId.equals(comment.id) && !reply.isDeleted(),
      ).length;
      this.#comments.replace(
        TodoComment.reconstitute({
          ...stored,
          likeCount,
          replyCount: comment.isReply() ? stored.replyCount : replyCount,
        }),
      );
    }
    const remaining = this.#comments.list();
    return affectedTodoIds.map((todoId) => ({
      todoId,
      commentCount: remaining.filter(
        (comment) => comment.todoId.value === todoId && !comment.isDeleted(),
      ).length,
    }));
  }
}
