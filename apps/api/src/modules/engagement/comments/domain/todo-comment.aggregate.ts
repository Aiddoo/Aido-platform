import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { CommentPlacement } from "./comment-placement.vo.js";
import { TodoCommentContent } from "./todo-comment-content.vo.js";
import { TodoCommentId } from "./todo-comment-id.vo.js";

export interface TodoCommentPrimitives {
  readonly id: string;
  readonly todoId: number;
  readonly authorId: string;
  /** 답글이 속한 묶음의 머리 댓글. 댓글이면 null */
  readonly parentId: string | null;
  /** 답글이 답한 글(댓글 또는 같은 묶음의 답글). 댓글이면 null */
  readonly replyToCommentId: string | null;
  readonly clientRequestId: string;
  /** 같은 멱등 키가 같은 요청인지 보는 지문. 지문 도입 전 행은 null이다 */
  readonly requestFingerprint: string | null;
  readonly content: string | null;
  readonly likeCount: number;
  readonly replyCount: number;
  readonly deletedAt: Temporal.Instant | null;
  readonly editedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface TodoCommentProps {
  readonly todoId: number;
  readonly authorId: UserId;
  readonly placement: CommentPlacement;
  readonly clientRequestId: string;
  readonly requestFingerprint: string | null;
  content: TodoCommentContent | null;
  likeCount: number;
  replyCount: number;
  deletedAt: Temporal.Instant | null;
  editedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateTodoCommentParams {
  readonly id: TodoCommentId;
  readonly todoId: number;
  readonly authorId: UserId;
  readonly placement: CommentPlacement;
  readonly content: TodoCommentContent;
  readonly clientRequestId: string;
  readonly requestFingerprint: string;
  readonly createdAt: Temporal.Instant;
}

export class TodoComment extends AggregateRoot<TodoCommentId, TodoCommentProps> {
  static create(params: CreateTodoCommentParams): TodoComment {
    return new TodoComment(params.id, {
      todoId: params.todoId,
      authorId: params.authorId,
      placement: params.placement,
      clientRequestId: params.clientRequestId,
      requestFingerprint: params.requestFingerprint,
      content: params.content,
      likeCount: 0,
      replyCount: 0,
      deletedAt: null,
      editedAt: null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    });
  }

  static reconstitute(primitives: TodoCommentPrimitives): TodoComment {
    return new TodoComment(TodoCommentId.reconstitute(primitives.id), {
      todoId: primitives.todoId,
      authorId: UserId.reconstitute(primitives.authorId),
      placement: CommentPlacement.reconstitute(primitives),
      clientRequestId: primitives.clientRequestId,
      requestFingerprint: primitives.requestFingerprint,
      content:
        primitives.content == null ? null : TodoCommentContent.reconstitute(primitives.content),
      likeCount: primitives.likeCount,
      replyCount: primitives.replyCount,
      deletedAt: primitives.deletedAt,
      editedAt: primitives.editedAt,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get todoId(): number {
    return this.props.todoId;
  }

  get authorId(): UserId {
    return this.props.authorId;
  }

  get placement(): CommentPlacement {
    return this.props.placement;
  }

  get isReply(): boolean {
    return this.props.placement.isReply;
  }

  /** 이 글이 속한 묶음의 머리 댓글. 댓글이면 자기 자신이다 */
  get threadCommentId(): TodoCommentId {
    const threadCommentId = this.props.placement.threadCommentId;
    return threadCommentId == null ? this.id : TodoCommentId.reconstitute(threadCommentId);
  }

  get clientRequestId(): string {
    return this.props.clientRequestId;
  }

  get requestFingerprint(): string | null {
    return this.props.requestFingerprint;
  }

  /** 저장된 빈 원문은 지운 글처럼 null로 읽는다(이전 복원 계약). 저장할 때는 원래 값을 그대로 둔다 */
  get content(): string | null {
    const content = this.props.content?.value;
    return content == null || content.length === 0 ? null : content;
  }

  get likeCount(): number {
    return this.props.likeCount;
  }

  get replyCount(): number {
    return this.props.replyCount;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt != null;
  }

  isAuthoredBy(userId: UserId): boolean {
    return this.props.authorId.equals(userId);
  }

  /** 이 글에 답할 자리. 지운 글에는 답하지 못한다 */
  placeReply(): CommentPlacement {
    this.assertActive();
    return CommentPlacement.create({ id: this.id.value, placement: this.props.placement });
  }

  // 같은 내용으로 고쳐도 수정 시각을 남긴다. 출시 앱은 이 시각으로 '수정됨'을 그린다
  // 작성자·삭제 여부를 내용 검증보다 먼저 본다(오류 우선순위)
  edit(actorId: UserId, rawContent: string, now: Temporal.Instant): boolean {
    if (!this.isAuthoredBy(actorId)) {
      throw new DomainException(ErrorCode.TODO_0832, { commentId: this.id.value });
    }
    this.assertActive();
    this.props.content = TodoCommentContent.create(rawContent);
    this.props.editedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  /** 작성자와 할 일 주인만 지운다. 주인은 자기 할 일에 달린 남의 글을 모두에게서 지운다. 이미 지운 글이면 false다 */
  markDeleted(params: {
    readonly actorId: UserId;
    readonly todoOwnerId: UserId;
    readonly now: Temporal.Instant;
  }): boolean {
    if (!this.isAuthoredBy(params.actorId) && !params.actorId.equals(params.todoOwnerId)) {
      throw new DomainException(ErrorCode.TODO_0832, { commentId: this.id.value });
    }
    if (this.isDeleted) {
      return false;
    }
    this.props.content = null;
    this.props.likeCount = 0;
    this.props.deletedAt = params.now;
    this.props.updatedAt = params.now;
    return true;
  }

  /** 답글 수는 묶음 머리인 댓글만 가진다 */
  addReplies(count: number, now: Temporal.Instant): boolean {
    this.#assertThreadHead();
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new DomainException(ErrorCode.SYS_0002, { commentId: this.id.value });
    }
    this.props.replyCount += count;
    this.props.updatedAt = now;
    return true;
  }

  removeReply(now: Temporal.Instant): boolean {
    this.#assertThreadHead();
    if (this.props.replyCount === 0) {
      throw new DomainException(ErrorCode.SYS_0003, { commentId: this.id.value });
    }
    this.props.replyCount -= 1;
    this.props.updatedAt = now;
    return true;
  }

  addLike(now: Temporal.Instant): boolean {
    this.assertActive();
    this.props.likeCount += 1;
    this.props.updatedAt = now;
    return true;
  }

  removeLike(now: Temporal.Instant): boolean {
    this.assertActive();
    if (this.props.likeCount === 0) {
      throw new DomainException(ErrorCode.SYS_0003, { commentId: this.id.value });
    }
    this.props.likeCount -= 1;
    this.props.updatedAt = now;
    return true;
  }

  assertActive(): void {
    if (this.isDeleted) {
      throw new DomainException(ErrorCode.TODO_0833, { commentId: this.id.value });
    }
  }

  toPrimitives(): TodoCommentPrimitives {
    const placement = this.props.placement;
    return {
      id: this.id.value,
      todoId: this.props.todoId,
      authorId: this.props.authorId.value,
      parentId: placement.threadCommentId,
      replyToCommentId: placement.replyToCommentId,
      clientRequestId: this.props.clientRequestId,
      requestFingerprint: this.props.requestFingerprint,
      content: this.props.content?.value ?? null,
      likeCount: this.props.likeCount,
      replyCount: this.props.replyCount,
      deletedAt: this.props.deletedAt,
      editedAt: this.props.editedAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  #assertThreadHead(): void {
    if (this.isReply) {
      throw new DomainException(ErrorCode.SYS_0003, { commentId: this.id.value });
    }
  }
}
