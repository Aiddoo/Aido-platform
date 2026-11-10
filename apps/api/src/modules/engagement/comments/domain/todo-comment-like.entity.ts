import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { TodoCommentId } from "./todo-comment-id.vo.js";
import { TodoCommentLikeId } from "./todo-comment-like-id.vo.js";

export interface TodoCommentLikePrimitives {
  readonly commentId: string;
  readonly userId: string;
  readonly isActive: boolean;
  /** 좋아요 알림을 보낸 시각. 껐다 켜도 다시 알리지 않으려고 남긴다 */
  readonly notifiedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface TodoCommentLikeProps {
  readonly commentId: TodoCommentId;
  readonly userId: UserId;
  isActive: boolean;
  notifiedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

export class TodoCommentLike extends Entity<TodoCommentLikeId, TodoCommentLikeProps> {
  static create(params: {
    readonly commentId: TodoCommentId;
    readonly userId: UserId;
    readonly now: Temporal.Instant;
  }): TodoCommentLike {
    return new TodoCommentLike(
      TodoCommentLikeId.create({ commentId: params.commentId, userId: params.userId.value }),
      {
        commentId: params.commentId,
        userId: params.userId,
        isActive: true,
        notifiedAt: null,
        createdAt: params.now,
        updatedAt: params.now,
      },
    );
  }

  static reconstitute(primitives: TodoCommentLikePrimitives): TodoCommentLike {
    const commentId = TodoCommentId.reconstitute(primitives.commentId);
    return new TodoCommentLike(TodoCommentLikeId.create({ commentId, userId: primitives.userId }), {
      commentId,
      userId: UserId.reconstitute(primitives.userId),
      isActive: primitives.isActive,
      notifiedAt: primitives.notifiedAt,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get commentId(): TodoCommentId {
    return this.props.commentId;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get wasEverNotified(): boolean {
    return this.props.notifiedAt != null;
  }

  /** 켜져 있고 아직 알리지 않은 좋아요 */
  get isNotificationPending(): boolean {
    return this.props.isActive && this.props.notifiedAt == null;
  }

  activate(now: Temporal.Instant): boolean {
    if (this.props.isActive) {
      return false;
    }
    this.props.isActive = true;
    this.props.updatedAt = now;
    return true;
  }

  deactivate(now: Temporal.Instant): boolean {
    if (!this.props.isActive) {
      return false;
    }
    this.props.isActive = false;
    this.props.updatedAt = now;
    return true;
  }

  markNotified(now: Temporal.Instant): boolean {
    if (!this.isNotificationPending) {
      return false;
    }
    this.props.notifiedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): TodoCommentLikePrimitives {
    return {
      commentId: this.props.commentId.value,
      userId: this.props.userId.value,
      isActive: this.props.isActive,
      notifiedAt: this.props.notifiedAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
