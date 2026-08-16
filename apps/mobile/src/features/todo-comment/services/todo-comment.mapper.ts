import type {
  DeleteTodoCommentResponse,
  PaginatedTodoComments,
  TodoComment as TodoCommentDTO,
  TodoCommentLikeResponse,
  TodoCommentChainResponse,
  TodoCommentMutationResponse,
  TodoCommentPreview as TodoCommentPreviewDTO,
  TodoCommentThreadResponse,
} from '@aido/validators';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentPage,
  TodoCommentPreview,
  TodoCommentThread,
} from '../models/todo-comment.model';

/** DTO의 ISO 문자열을 도메인의 Date로 옮긴다 — 서버 응답 변경의 충격을 여기서 흡수한다. */

export const toTodoCommentPreview = (dto: TodoCommentPreviewDTO): TodoCommentPreview => ({
  id: dto.id,
  todoId: dto.todoId,
  parentId: dto.parentId,
  rootId: dto.rootId,
  depth: dto.depth,
  author: dto.author,
  content: dto.content,
  isDeleted: dto.isDeleted,
  isEdited: dto.isEdited,
  likeCount: dto.likeCount,
  replyCount: dto.replyCount,
  hasReplies: dto.hasReplies,
  hasMoreReplies: dto.hasMoreReplies,
  replyTo: dto.replyTo,
  viewer: dto.viewer,
  createdAt: new Date(dto.createdAt),
  editedAt: dto.editedAt ? new Date(dto.editedAt) : null,
});

export const toTodoComment = (dto: TodoCommentDTO): TodoComment => ({
  ...toTodoCommentPreview(dto),
  replyPreview: dto.replyPreview.map(toTodoCommentPreview),
});

export const toTodoCommentChain = (dto: TodoCommentChainResponse): TodoCommentChain => ({
  comments: dto.comments.map(toTodoComment),
});

export const toMutatedComment = (dto: TodoCommentMutationResponse): TodoComment =>
  toTodoComment(dto.comment);

export const toTodoCommentPage = (dto: PaginatedTodoComments): TodoCommentPage => ({
  comments: dto.items.map(toTodoComment),
  nextCursor: dto.pagination.nextCursor,
  hasNext: dto.pagination.hasNext,
});

export const toTodoCommentThread = (dto: TodoCommentThreadResponse): TodoCommentThread => ({
  ancestors: dto.ancestors.map(toTodoCommentPreview),
  comment: toTodoComment(dto.comment),
});

export const toTodoCommentLikeResult = (dto: TodoCommentLikeResponse): TodoCommentLikeResult => ({
  commentId: dto.commentId,
  isLiked: dto.isLiked,
  likeCount: dto.likeCount,
});

export const toDeletedCommentId = (dto: DeleteTodoCommentResponse): string => dto.commentId;
