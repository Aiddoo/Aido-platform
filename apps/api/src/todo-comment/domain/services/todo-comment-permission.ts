export interface TodoCommentViewerPermissions {
	isLiked: boolean;
	canEdit: boolean;
	canDelete: boolean;
	canReply: boolean;
}

export function getTodoCommentViewerPermissions(input: {
	isDeleted: boolean;
	isLiked: boolean;
	authorId: string;
	viewerId: string;
}): TodoCommentViewerPermissions {
	const isAuthor = input.authorId === input.viewerId;
	const canManage = !input.isDeleted && isAuthor;

	return {
		isLiked: !input.isDeleted && input.isLiked,
		canEdit: canManage,
		canDelete: canManage,
		canReply: !input.isDeleted,
	};
}

export interface TodoDetailsPermissions {
	canEdit: boolean;
	canComment: boolean;
	canNudge: boolean;
}

export function getTodoDetailsPermissions(isOwner: boolean): TodoDetailsPermissions {
	return {
		canEdit: isOwner,
		canComment: true,
		canNudge: !isOwner,
	};
}
