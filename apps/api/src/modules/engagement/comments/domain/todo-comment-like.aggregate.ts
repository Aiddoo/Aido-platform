import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

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

interface CreateTodoCommentLikeParams {
  readonly commentId: TodoCommentId;
  readonly userId: UserId;
  readonly now: Temporal.Instant;
}

/**
 * 한 사람이 한 글에 누른 좋아요. 수명주기가 글과 따로라(누르고 끄고 다시 켠다) 자기 저장소를 가진 Root다.
 * 글의 좋아요 수는 같은 댓글 잠금 안에서 TodoComment가 함께 센다.
 */
export class TodoCommentLike extends AggregateRoot<TodoCommentLikeId, TodoCommentLikeProps> {
  /** 처음 누른 좋아요. 켜진 채로 만들고 아직 알리지 않았다 */
  static create(params: CreateTodoCommentLikeParams): TodoCommentLike {
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

  like(now: Temporal.Instant): boolean {
    if (this.props.isActive) {
      return false;
    }
    this.props.isActive = true;
    this.props.updatedAt = now;
    return true;
  }

  unlike(now: Temporal.Instant): boolean {
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
