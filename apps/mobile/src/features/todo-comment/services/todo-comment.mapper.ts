import type {
  DeleteTodoCommentResponse,
  TodoComment as TodoCommentDTO,
  TodoCommentOverviewItem as TodoCommentOverviewItemDTO,
  TodoCommentOverviewResponse,
  TodoCommentLikeResponse,
  TodoCommentChainResponse,
  TodoCommentMutationResponse,
  TodoConversationItem as TodoConversationItemDTO,
  TodoConversationResponse,
} from '@aido/validators';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentOverviewItem,
  TodoCommentOverviewPage,
  TodoConversationItem,
  TodoConversationPage,
} from '../models/todo-comment.model';

export const toTodoComment = (dto: TodoCommentDTO): TodoComment => ({
  id: dto.id,
  threadId: dto.threadId,
  parentId: dto.parentId,
  depth: dto.depth,
  author: dto.author,
  content: dto.content,
  isDeleted: dto.isDeleted,
  isEdited: dto.isEdited,
  likeCount: dto.likeCount,
  replyCount: dto.replyCount,
  replyTo: dto.replyTo,
  viewer: dto.viewer,
  createdAt: new Date(dto.createdAt),
  editedAt: dto.editedAt ? new Date(dto.editedAt) : null,
});

export const toTodoCommentChain = (dto: TodoCommentChainResponse): TodoCommentChain => ({
  comments: dto.comments.map(toTodoComment),
});

export const toMutatedComment = (dto: TodoCommentMutationResponse): TodoComment =>
  toTodoComment(dto.comment);

export const toTodoCommentOverviewItem = (
  dto: TodoCommentOverviewItemDTO,
): TodoCommentOverviewItem => ({
  comment: toTodoComment(dto.comment),
  previewReply: dto.previewReply === null ? null : toTodoComment(dto.previewReply),
  replySummary: dto.replySummary,
});

export const toTodoCommentOverviewPage = (
  dto: TodoCommentOverviewResponse,
): TodoCommentOverviewPage => ({
  items: dto.items.map(toTodoCommentOverviewItem),
  pagination: dto.pagination,
});

export const toTodoConversationItem = (dto: TodoConversationItemDTO): TodoConversationItem => ({
  comment: toTodoComment(dto.comment),
  connection: dto.connection,
  isFocused: dto.isFocused,
});

export const toTodoConversationPage = (dto: TodoConversationResponse): TodoConversationPage => ({
  items: dto.items.map(toTodoConversationItem),
  focus:
    dto.focus === null
      ? null
      : {
          ...dto.focus,
          precedingAncestors: dto.focus.precedingAncestors.map(toTodoConversationItem),
        },
  pagination: dto.pagination,
});

export const toTodoCommentLikeResult = (dto: TodoCommentLikeResponse): TodoCommentLikeResult => ({
  commentId: dto.commentId,
  isLiked: dto.isLiked,
  likeCount: dto.likeCount,
});

export const toDeletedCommentId = (dto: DeleteTodoCommentResponse): string => dto.commentId;
