export const TODO_COMMENT_NOTIFICATION = Symbol("TODO_COMMENT_NOTIFICATION");

export interface TodoCommentActivityNotificationInput {
	readonly recipientId: string;
	readonly senderId: string;
	readonly senderName: string | null;
	readonly todoId: number;
	readonly commentId: string;
	/** 이 댓글이 속한 대화의 뿌리 */
	readonly threadRootId: string;
}

export interface TodoCommentWrittenInput extends TodoCommentActivityNotificationInput {
	/** 댓글인지 답글인지 — 받는 사람이 할 일 주인인지 부모 댓글 작성자인지와 짝을 이룬다. */
	readonly isReply: boolean;
	/** 한 번에 이어 쓴 글 수. 여러 개여도 알림은 한 건이고, 개수는 문구가 말한다. */
	readonly commentCount: number;
}

export interface TodoCommentNotificationPort {
	notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void>;
	notifyCommentLiked(input: TodoCommentActivityNotificationInput): Promise<void>;
}
