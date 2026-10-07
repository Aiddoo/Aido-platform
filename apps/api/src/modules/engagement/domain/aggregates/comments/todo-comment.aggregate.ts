import { ErrorCode } from "@aido/api/errors";

import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import type { TodoCommentState } from "../../records/comments/todo-comment.record.js";
import { ThreadPlacement } from "../../value-objects/comments/thread-placement.vo.js";
import { TodoCommentContent } from "../../value-objects/comments/todo-comment-content.vo.js";
import { TodoCommentId } from "../../value-objects/comments/todo-comment-id.vo.js";

interface TodoCommentProps {
  id: TodoCommentId;
  todoId: number;
  authorId: string;
  placement: ThreadPlacement;
  content: TodoCommentContent | null;
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
      placement: ThreadPlacement.reconstitute({
        parentId: props.parentId,
        rootId: props.rootId,
        path: props.path,
      }),
      content:
        props.content === null || props.content.length === 0
          ? null
          : TodoCommentContent.create(props.content),
      deletedAt: props.deletedAt === null ? null : new Date(props.deletedAt),
      editedAt: props.editedAt === null ? null : new Date(props.editedAt),
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

  get placement(): ThreadPlacement {
    return this.props.placement;
  }

  get threadRootId(): TodoCommentId {
    return this.props.placement.rootId ?? this.props.id;
  }

  placeReply(): ThreadPlacement {
    this.assertCanReceiveInteraction();

    return this.props.placement.under(this.props.id);
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  get content(): string | null {
    return this.props.content?.getValue() ?? null;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt === null ? null : new Date(this.props.deletedAt);
  }

  get editedAt(): Date | null {
    return this.props.editedAt === null ? null : new Date(this.props.editedAt);
  }

  get snapshot(): TodoCommentState {
    return {
      id: this.props.id.getValue(),
      todoId: this.props.todoId,
      authorId: this.props.authorId,
      parentId: this.props.placement.parentId?.getValue() ?? null,
      rootId: this.props.placement.rootId?.getValue() ?? null,
      path: this.props.placement.path,
      content: this.content,
      deletedAt: this.deletedAt,
      editedAt: this.editedAt,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  edit(userId: string, content: string, editedAt: Date): void {
    this.assertAuthor(userId);
    this.assertActive();
    this.props.content = TodoCommentContent.create(content);
    this.props.editedAt = new Date(editedAt);
    this.props.updatedAt = new Date(editedAt);
  }

  delete(userId: string, deletedAt: Date): void {
    this.assertAuthor(userId);

    if (this.isDeleted) {
      return;
    }

    this.props.content = null;
    this.props.deletedAt = new Date(deletedAt);
    this.props.updatedAt = new Date(deletedAt);
  }

  assertCanReceiveInteraction(): void {
    this.assertActive();
  }

  private assertAuthor(userId: string): void {
    if (this.props.authorId !== userId) {
      throw new DomainException(ErrorCode.TODO_0832, {
        commentId: this.props.id.getValue(),
      });
    }
  }

  private assertActive(): void {
    if (this.isDeleted) {
      throw new DomainException(ErrorCode.TODO_0833, {
        commentId: this.props.id.getValue(),
      });
    }
  }
}
