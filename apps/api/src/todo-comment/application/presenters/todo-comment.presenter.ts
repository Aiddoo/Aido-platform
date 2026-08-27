import type { TodoComment, TodoCommentAuthor } from "@aido/validators";

import type { TodoCommentParticipantAuthorRecord, TodoCommentRecord } from "../types";

export function toTodoCommentResponse(
	record: TodoCommentRecord,
	viewerId: string,
	likedCommentIds: ReadonlySet<string>,
): TodoComment {
	const isDeleted = record.deletedAt !== null;
	const authorId = record.authorId;
	const canEdit = !isDeleted && authorId === viewerId;

	return {
		id: record.id,
		threadId: record.rootId ?? record.id,
		parentId: record.parentId,
		depth: record.depth,
		author: !isDeleted
			? {
					id: authorId,
					name: record.authorName,
					profileImage: record.authorProfileImage,
					isTodoOwner: authorId === record.todoOwnerId,
				}
			: null,
		content: isDeleted ? null : record.content,
		isDeleted,
		isEdited: record.editedAt !== null,
		likeCount: isDeleted ? 0 : record.likeCount,
		replyCount: record.replyCount,
		replyTo:
			record.parentId === null
				? null
				: { commentId: record.parentId, authorName: record.parentAuthorName },
		viewer: {
			isLiked: !isDeleted && likedCommentIds.has(record.id),
			canEdit,
			canDelete: canEdit,
			canReply: !isDeleted,
		},
		createdAt: record.createdAt,
		editedAt: record.editedAt,
	};
}

export function collectCommentIds(records: readonly TodoCommentRecord[]): string[] {
	return records.map((record) => record.id);
}

export function toTodoCommentAuthorResponse(
	record: TodoCommentParticipantAuthorRecord,
): TodoCommentAuthor {
	return {
		id: record.id,
		name: record.name,
		profileImage: record.profileImage,
		isTodoOwner: record.isTodoOwner,
	};
}
