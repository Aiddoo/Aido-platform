import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import type { TodoCommentState } from "../../records/comments/todo-comment.record.js";
import { CommentPlacement } from "../../value-objects/comments/comment-placement.vo.js";
import { TodoCommentContent } from "../../value-objects/comments/todo-comment-content.vo.js";
import { TodoCommentId } from "../../value-objects/comments/todo-comment-id.vo.js";

interface TodoCommentProps {
  id: TodoCommentId;
  todoId: number;
  authorId: string;
  placement: CommentPlacement;
  content: TodoCommentContent | null;
  replyCount: number;
  deletedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TodoComment extends AggregateRoot<TodoCommentProps> {
  static reconstitute(props: TodoCommentState): TodoComment {
    return new TodoComment({
      id: TodoCommentId.create(props.id),
      todoId: props.todoId,
      authorId: props.authorId,
      placement: CommentPlacement.reconstitute({
        parentId: props.parentId,
        replyToCommentId: props.replyToCommentId,
      }),
      content:
        props.content == null || props.content.length === 0
          ? null
          : TodoCommentContent.create(props.content),
      replyCount: props.replyCount,
      deletedAt: props.deletedAt == null ? null : new Date(props.deletedAt),
      editedAt: props.editedAt == null ? null : new Date(props.editedAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): TodoCommentId {
    return this.props.id;
  }

  get todoId(): number {
    return this.props.todoId;
  }

  get authorId(): string {
    return this.props.authorId;
  }

  get placement(): CommentPlacement {
    return this.props.placement;
  }

  get isReply(): boolean {
    return this.props.placement.kind === "REPLY";
  }

  /** 이 글이 속한 묶음의 머리 댓글. 댓글이면 자기 자신이다 */
  get threadCommentId(): string {
    return this.props.placement.kind === "COMMENT"
      ? this.props.id.getValue()
      : this.props.placement.threadCommentId;
  }

  get replyCount(): number {
    return this.props.replyCount;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt != null;
  }

  get content(): string | null {
    return this.props.content?.getValue() ?? null;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt == null ? null : new Date(this.props.deletedAt);
  }

  get editedAt(): Date | null {
    return this.props.editedAt == null ? null : new Date(this.props.editedAt);
  }

  get snapshot(): TodoCommentState {
    const placement = this.props.placement;

    return {
      id: this.props.id.getValue(),
      todoId: this.props.todoId,
      authorId: this.props.authorId,
      parentId: placement.kind === "COMMENT" ? null : placement.threadCommentId,
      replyToCommentId: placement.kind === "COMMENT" ? null : placement.replyToCommentId,
      content: this.content,
      replyCount: this.props.replyCount,
      deletedAt: this.deletedAt,
      editedAt: this.editedAt,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  placeReply(): CommentPlacement {
    this.assertActive();

    return CommentPlacement.replyTo({
      id: this.props.id.getValue(),
      placement: this.props.placement,
    });
  }

  edit(userId: string, content: string, editedAt: Date): void {
    this.assertAuthor(userId);
    this.assertActive();
    this.props.content = TodoCommentContent.create(content);
    this.props.editedAt = new Date(editedAt);
    this.props.updatedAt = new Date(editedAt);
  }

  /**
   * 작성자와 할 일 주인만 지울 수 있다. 주인은 자기 할 일에 달린 남의 댓글을 모두에게서 지운다.
   * 이미 지운 글이면 아무것도 바꾸지 않고 false다.
   */
  markDeleted(input: { actorId: string; todoOwnerId: string; deletedAt: Date }): boolean {
    if (input.actorId !== this.props.authorId && input.actorId !== input.todoOwnerId) {
      throw new DomainException(ErrorCode.TODO_0832, { commentId: this.props.id.getValue() });
    }

    if (this.isDeleted) {
      return false;
    }

    this.props.content = null;
    this.props.deletedAt = new Date(input.deletedAt);
    this.props.updatedAt = new Date(input.deletedAt);
    return true;
  }

  /** 답글 수는 묶음 머리인 댓글만 가진다 */
  applyReplyAdded(count: number): void {
    this.assertComment();
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new DomainException(ErrorCode.SYS_0002, { commentId: this.props.id.getValue() });
    }

    this.props.replyCount += count;
  }

  applyReplyRemoved(): void {
    this.assertComment();
    if (this.props.replyCount === 0) {
      throw new DomainException(ErrorCode.SYS_0003, { commentId: this.props.id.getValue() });
    }

    this.props.replyCount -= 1;
  }

  assertActive(): void {
    if (this.isDeleted) {
      throw new DomainException(ErrorCode.TODO_0833, {
        commentId: this.props.id.getValue(),
      });
    }
  }

  private assertComment(): void {
    if (this.props.placement.kind !== "COMMENT") {
      throw new DomainException(ErrorCode.SYS_0003, { commentId: this.props.id.getValue() });
    }
  }

  private assertAuthor(userId: string): void {
    if (this.props.authorId !== userId) {
      throw new DomainException(ErrorCode.TODO_0832, {
        commentId: this.props.id.getValue(),
      });
    }
  }
}
