import type {
  DeleteTodoCommentResponse,
  TodoComment as TodoCommentV1DTO,
  TodoCommentChainResponse,
  TodoCommentLikeResponse,
  TodoCommentMutationResponse,
  TodoCommentRepliesResponse,
  TodoCommentThread as TodoCommentThreadDTO,
  TodoCommentThreadsResponse,
  TodoCommentV2,
} from '@aido/api';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentReplyPage,
  TodoCommentThread,
  TodoCommentThreadPage,
} from '../domains/todo-comment.model';

function toTodoComment(dto: TodoCommentV2): TodoComment {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    editedAt: dto.editedAt == null ? null : new Date(dto.editedAt),
  };
}

/** 쓰기 응답은 v1 모양이다. v1의 parentId는 묶음 머리라 v2의 threadCommentId와 같다 */
export function toTodoCommentFromV1(todoId: number, dto: TodoCommentV1DTO): TodoComment {
  return {
    id: dto.id,
    todoId,
    threadCommentId: dto.parentId,
    replyTo: dto.replyTo,
    author: dto.author == null ? null : { ...dto.author, userTag: dto.author.userTag ?? null },
    content: dto.content,
    likeCount: dto.likeCount,
    replyCount: dto.replyCount,
    isDeleted: dto.isDeleted,
    isAuthorBlocked: dto.isAuthorBlocked ?? false,
    isEdited: dto.isEdited,
    viewer: {
      ...dto.viewer,
      canReport: dto.viewer.canReport ?? false,
      canBlock: dto.viewer.canBlock ?? false,
    },
    createdAt: new Date(dto.createdAt),
    editedAt: dto.editedAt == null ? null : new Date(dto.editedAt),
  };
}

function toTodoCommentThread(dto: TodoCommentThreadDTO): TodoCommentThread {
  return {
    comment: toTodoComment(dto.comment),
    previewReply: dto.previewReply == null ? null : toTodoComment(dto.previewReply),
    replySummary: dto.replySummary,
  };
}

export function toTodoCommentThreadPage(dto: TodoCommentThreadsResponse): TodoCommentThreadPage {
  return {
    items: dto.items.map(toTodoCommentThread),
    pagination: dto.pagination,
    anchor: dto.anchor,
  };
}

export function toTodoCommentReplyPage(dto: TodoCommentRepliesResponse): TodoCommentReplyPage {
  return { items: dto.items.map(toTodoComment), pagination: dto.pagination };
}

export function toTodoCommentChain(
  todoId: number,
  dto: TodoCommentChainResponse,
): TodoCommentChain {
  return { comments: dto.comments.map((comment) => toTodoCommentFromV1(todoId, comment)) };
}

export function toMutatedComment(todoId: number, dto: TodoCommentMutationResponse): TodoComment {
  return toTodoCommentFromV1(todoId, dto.comment);
}

export function toTodoCommentLikeResult(dto: TodoCommentLikeResponse): TodoCommentLikeResult {
  return { commentId: dto.commentId, isLiked: dto.isLiked, likeCount: dto.likeCount };
}

export function toDeletedCommentId(dto: DeleteTodoCommentResponse): string {
  return dto.commentId;
}
