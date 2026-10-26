export interface TodoCommentViewerPermissions {
  readonly isLiked: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canReply: boolean;
  /** 남의 댓글만 신고·차단할 수 있다. 가린 댓글·삭제된 댓글은 대상을 알 수 없어 막는다 */
  readonly canReport: boolean;
  readonly canBlock: boolean;
}

export function getTodoCommentViewerPermissions(input: {
  readonly isDeleted: boolean;
  readonly isLiked: boolean;
  readonly authorId: string;
  readonly viewerId: string;
  /** 할 일 주인은 자기 할 일에 달린 남의 댓글도 지울 수 있다(수정은 작성자만) */
  readonly todoOwnerId: string;
}): TodoCommentViewerPermissions {
  const isAuthor = input.authorId === input.viewerId;
  const isTodoOwner = input.todoOwnerId === input.viewerId;
  const canManage = !input.isDeleted && isAuthor;
  const canModerate = !input.isDeleted && !isAuthor;

  return {
    isLiked: !input.isDeleted && input.isLiked,
    canEdit: canManage,
    canDelete: !input.isDeleted && (isAuthor || isTodoOwner),
    canReply: !input.isDeleted,
    canReport: canModerate,
    canBlock: canModerate,
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
