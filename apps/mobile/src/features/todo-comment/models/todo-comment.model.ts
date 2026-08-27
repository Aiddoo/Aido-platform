import {
  TODO_COMMENT_LIMITS,
  type TodoComment as TodoCommentDTO,
  type TodoCommentAuthor as TodoCommentAuthorDTO,
  type TodoCommentLikeResponse,
  type TodoCommentOverviewItem as TodoCommentOverviewItemDTO,
  type TodoCommentOverviewResponse,
  type TodoCommentReplySummary as TodoCommentReplySummaryDTO,
  type TodoCommentReplyTarget as TodoCommentReplyTargetDTO,
  type TodoCommentSort as TodoCommentSortDTO,
  type TodoConversationConnection as TodoConversationConnectionDTO,
  type TodoConversationFocus as TodoConversationFocusDTO,
  type TodoConversationIncomingBranch as TodoConversationIncomingBranchDTO,
  type TodoConversationItem as TodoConversationItemDTO,
  type TodoConversationResponse,
} from '@aido/validators';

export type TodoCommentSort = TodoCommentSortDTO;
export type TodoCommentAuthor = TodoCommentAuthorDTO;
export type TodoCommentViewer = TodoCommentDTO['viewer'];
export type TodoCommentReplyTarget = TodoCommentReplyTargetDTO;

export type TodoComment = Omit<TodoCommentDTO, 'createdAt' | 'editedAt'> & {
  createdAt: Date;
  editedAt: Date | null;
};

export type TodoCommentReplySummary = TodoCommentReplySummaryDTO;

export type TodoCommentOverviewItem = Omit<
  TodoCommentOverviewItemDTO,
  'comment' | 'previewReply'
> & {
  comment: TodoComment;
  previewReply: TodoComment | null;
};

export type TodoCommentOverviewPage = Omit<TodoCommentOverviewResponse, 'items'> & {
  items: TodoCommentOverviewItem[];
};

export type TodoConversationIncomingBranch = TodoConversationIncomingBranchDTO;
export type TodoConversationConnection = TodoConversationConnectionDTO;
export type TodoConversationItem = Omit<TodoConversationItemDTO, 'comment'> & {
  comment: TodoComment;
};
export type TodoConversationFocus = Omit<TodoConversationFocusDTO, 'precedingAncestors'> & {
  precedingAncestors: TodoConversationItem[];
};
export type TodoConversationPage = Omit<TodoConversationResponse, 'items' | 'focus'> & {
  items: TodoConversationItem[];
  focus: TodoConversationFocus | null;
};

export interface TodoCommentChain {
  comments: TodoComment[];
}

export type TodoCommentLikeResult = TodoCommentLikeResponse;

const isAlive = (comment: TodoComment) => !comment.isDeleted;

const isActionable = (comment: TodoComment) => isAlive(comment);

export const TodoCommentPolicy = {
  canAct: (comment: TodoComment) => isActionable(comment),
  canLike: (comment: TodoComment) => isActionable(comment),
  canReply: (comment: TodoComment) => isActionable(comment) && comment.viewer.canReply,
  canEdit: (comment: TodoComment) => isActionable(comment) && comment.viewer.canEdit,
  canDelete: (comment: TodoComment) => isActionable(comment) && comment.viewer.canDelete,
  canManage: (comment: TodoComment) =>
    TodoCommentPolicy.canEdit(comment) || TodoCommentPolicy.canDelete(comment),
} as const;

export const TodoCommentDraftPolicy = {
  canAddMore: ({ itemCount, isEditing }: { itemCount: number; isEditing: boolean }) =>
    !isEditing && itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE,
} as const;
