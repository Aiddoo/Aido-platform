import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from '@aido/validators';
import { z } from 'zod';

export const todoCommentSortSchema = z.enum(TODO_COMMENT_SORT);
export type TodoCommentSort = z.infer<typeof todoCommentSortSchema>;

export const todoCommentAuthorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  isTodoOwner: z.boolean(),
});
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;

export const todoCommentViewerSchema = z.object({
  isLiked: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canReply: z.boolean(),
});
export type TodoCommentViewer = z.infer<typeof todoCommentViewerSchema>;

export const todoCommentReplyTargetSchema = z.object({
  commentId: z.string(),
  authorName: z.string().nullable(),
});
export type TodoCommentReplyTarget = z.infer<typeof todoCommentReplyTargetSchema>;

export const todoCommentSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  parentId: z.string().nullable(),
  depth: z.number(),
  author: todoCommentAuthorSchema.nullable(),
  content: z.string().nullable(),
  isDeleted: z.boolean(),
  isEdited: z.boolean(),
  likeCount: z.number(),
  replyCount: z.number(),
  replyTo: todoCommentReplyTargetSchema.nullable(),
  viewer: todoCommentViewerSchema,
  createdAt: z.date(),
  editedAt: z.date().nullable(),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

export const todoCommentPaginationSchema = z.object({
  previousCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  hasPrevious: z.boolean(),
  hasNext: z.boolean(),
  size: z.number(),
});

export const todoCommentReplySummarySchema = z.object({
  totalCount: z.number(),
  hiddenCount: z.number(),
  hasMore: z.boolean(),
  participantAuthors: z.array(todoCommentAuthorSchema),
});
export type TodoCommentReplySummary = z.infer<typeof todoCommentReplySummarySchema>;

export const todoCommentOverviewItemSchema = z.object({
  comment: todoCommentSchema,
  previewReply: todoCommentSchema.nullable(),
  replySummary: todoCommentReplySummarySchema,
});
export type TodoCommentOverviewItem = z.infer<typeof todoCommentOverviewItemSchema>;

export const todoCommentOverviewPageSchema = z.object({
  items: z.array(todoCommentOverviewItemSchema),
  pagination: todoCommentPaginationSchema,
});
export type TodoCommentOverviewPage = z.infer<typeof todoCommentOverviewPageSchema>;

export const todoConversationIncomingBranchSchema = z.object({
  fromDepth: z.number(),
  toDepth: z.number(),
});
export type TodoConversationIncomingBranch = z.infer<typeof todoConversationIncomingBranchSchema>;

export const todoConversationConnectionSchema = z.object({
  visualDepth: z.number(),
  upperLaneDepths: z.array(z.number()),
  lowerLaneDepths: z.array(z.number()),
  incomingBranch: todoConversationIncomingBranchSchema.nullable(),
});
export type TodoConversationConnection = z.infer<typeof todoConversationConnectionSchema>;

export const todoConversationItemSchema = z.object({
  comment: todoCommentSchema,
  connection: todoConversationConnectionSchema,
  isFocused: z.boolean(),
});
export type TodoConversationItem = z.infer<typeof todoConversationItemSchema>;

export const todoConversationFocusSchema = z.object({
  commentId: z.string(),
  itemIndex: z.number(),
  precedingAncestors: z.array(todoConversationItemSchema),
  omittedAncestorCount: z.number(),
});
export type TodoConversationFocus = z.infer<typeof todoConversationFocusSchema>;

export const todoConversationPageSchema = z.object({
  items: z.array(todoConversationItemSchema),
  focus: todoConversationFocusSchema.nullable(),
  pagination: todoCommentPaginationSchema,
});
export type TodoConversationPage = z.infer<typeof todoConversationPageSchema>;

export const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

export const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.number(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

export function isActiveComment(comment: TodoComment) {
  return !comment.isDeleted;
}

export function canLikeComment(comment: TodoComment) {
  return isActiveComment(comment);
}

export function canReplyToComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canReply;
}

export function canEditComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canEdit;
}

export function canDeleteComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canDelete;
}

export function canManageComment(comment: TodoComment) {
  return canEditComment(comment) || canDeleteComment(comment);
}

export function hasCommentDraftCapacity(itemCount: number) {
  return itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE;
}

export const TodoCommentPolicy = {
  isActive: isActiveComment,
  canLike: canLikeComment,
  canReply: canReplyToComment,
  canEdit: canEditComment,
  canDelete: canDeleteComment,
  canManage: canManageComment,
} as const;

export const TodoCommentDraftPolicy = { hasCapacity: hasCommentDraftCapacity } as const;
