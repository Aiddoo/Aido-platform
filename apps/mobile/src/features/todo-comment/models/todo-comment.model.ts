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

const isActive = (comment: TodoComment) => !comment.isDeleted;

export const TodoCommentPolicy = {
  isActive,
  canLike: (comment: TodoComment) => isActive(comment),
  canReply: (comment: TodoComment) => isActive(comment) && comment.viewer.canReply,
  canEdit: (comment: TodoComment) => isActive(comment) && comment.viewer.canEdit,
  canDelete: (comment: TodoComment) => isActive(comment) && comment.viewer.canDelete,
  canManage: (comment: TodoComment) =>
    TodoCommentPolicy.canEdit(comment) || TodoCommentPolicy.canDelete(comment),
} as const;

export const TodoCommentDraftPolicy = {
  hasCapacity: (itemCount: number) => itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE,
} as const;
