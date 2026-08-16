import { ErrorCode } from "@aido/errors";

import { AggregateRoot, DomainException } from "@/shared/domain";

import { ThreadPlacement } from "../value-objects/thread-placement.vo";
import { TodoCommentContent } from "../value-objects/todo-comment-content.vo";
import { TodoCommentId } from "../value-objects/todo-comment-id.vo";

interface TodoCommentProps {
	id: TodoCommentId;
	todoId: number;
	authorId: string;
	/** 스레드에서 이 댓글이 놓인 자리 */
	placement: ThreadPlacement;
	content: TodoCommentContent | null;
	deletedAt: Date | null;
	editedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export class TodoComment extends AggregateRoot<TodoCommentProps> {
	static reconstitute(props: {
		id: string;
		todoId: number;
		authorId: string;
		parentId: string | null;
		rootId: string | null;
		path: readonly string[];
		content: string | null;
		deletedAt: Date | null;
		editedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	}): TodoComment {
		return new TodoComment({
			id: TodoCommentId.create(props.id),
			todoId: props.todoId,
			authorId: props.authorId,
			placement: ThreadPlacement.reconstitute({
				parentId: props.parentId,
				rootId: props.rootId,
				path: props.path,
			}),
			content: props.content ? TodoCommentContent.create(props.content) : null,
			deletedAt: props.deletedAt ? new Date(props.deletedAt) : null,
			editedAt: props.editedAt ? new Date(props.editedAt) : null,
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

	/** 이 댓글이 속한 대화의 뿌리. 최상위 댓글이면 자기 자신이다. */
	get threadRootId(): TodoCommentId {
		return this.props.placement.rootId ?? this.props.id;
	}

	/**
	 * 이 댓글에 달릴 답글의 자리.
	 * 삭제된 댓글은 답글을 받지 못하므로, 자리를 내주기 전에 상태부터 확인한다.
	 */
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
		return this.props.deletedAt ? new Date(this.props.deletedAt) : null;
	}

	get editedAt(): Date | null {
		return this.props.editedAt ? new Date(this.props.editedAt) : null;
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
