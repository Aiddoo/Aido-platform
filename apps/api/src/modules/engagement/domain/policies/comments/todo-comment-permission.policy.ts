export interface TodoCommentViewerPermissions {
  readonly isLiked: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canReply: boolean;
}

export function getTodoCommentViewerPermissions(input: {
  readonly isDeleted: boolean;
  readonly isLiked: boolean;
  readonly authorId: string;
  readonly viewerId: string;
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
  readonly canEdit: boolean;
  readonly canComment: boolean;
  readonly canNudge: boolean;
}

export function getTodoDetailsPermissions(isOwner: boolean): TodoDetailsPermissions {
  return {
    canEdit: isOwner,
    canComment: true,
    canNudge: !isOwner,
  };
}
