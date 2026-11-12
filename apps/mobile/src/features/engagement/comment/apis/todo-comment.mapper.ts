import type {
  DeleteTodoCommentResponse,
  GetTodoCommentRepliesQuery,
  GetTodoCommentThreadsQuery,
  TodoCommentLikeResponse,
  TodoCommentRepliesResponse,
  TodoCommentThread as TodoCommentThreadDto,
  TodoCommentThreadsResponse,
  TodoCommentV2,
} from '@aido/api';
import type { TodoCommentSort } from '@aido/api/vocabulary';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import { TODO_COMMENT_PAGE_SIZE } from '../constants/todo-comment.constants';
import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentReplyPage,
  TodoCommentThread,
  TodoCommentThreadPage,
} from '../domains/todo-comment.model';
import type {
  WrittenTodoCommentChainResponse,
  WrittenTodoCommentMutationResponse,
  WrittenTodoCommentResponse,
} from '../schemas/todo-comment-response.schema';
import type { TodoCommentPageParam } from '../utils/todo-comment-cache-pages';

function toTodoComment(dto: TodoCommentV2): TodoComment {
  return {
    ...pick(dto, [
      'id',
      'todoId',
      'threadCommentId',
      'replyTo',
      'author',
      'content',
      'likeCount',
      'replyCount',
      'isDeleted',
      'isAuthorBlocked',
      'isEdited',
      'viewer',
    ]),
    createdAt: toInstant(dto.createdAt),
    editedAt: toNullableInstant(dto.editedAt),
  };
}

/** 쓰기 응답은 v1 모양이다. v1의 parentId는 묶음 머리라 v2의 threadCommentId와 같다 */
export function toWrittenTodoComment(todoId: number, dto: WrittenTodoCommentResponse): TodoComment {
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
    isAuthorBlocked: dto.isAuthorBlocked,
    isEdited: dto.isEdited,
    viewer: dto.viewer,
    createdAt: toInstant(dto.createdAt),
    editedAt: toNullableInstant(dto.editedAt),
  };
}

function toTodoCommentThread(dto: TodoCommentThreadDto): TodoCommentThread {
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
  dto: WrittenTodoCommentChainResponse,
): TodoCommentChain {
  return { comments: dto.comments.map((comment) => toWrittenTodoComment(todoId, comment)) };
}

export function toMutatedComment(
  todoId: number,
  dto: WrittenTodoCommentMutationResponse,
): TodoComment {
  return toWrittenTodoComment(todoId, dto.comment);
}

export function toTodoCommentLikeResult(dto: TodoCommentLikeResponse): TodoCommentLikeResult {
  return { commentId: dto.commentId, isLiked: dto.isLiked, likeCount: dto.likeCount };
}

export function toDeletedCommentId(dto: DeleteTodoCommentResponse): string {
  return dto.commentId;
}

/** 첫 페이지만 anchor로 위치를 찾고, 이어지는 페이지는 서버가 준 cursor를 그대로 보낸다 */
export function toThreadsQuery(
  pageParam: TodoCommentPageParam,
  { sort, anchorCommentId }: { sort: TodoCommentSort; anchorCommentId: string | null },
): GetTodoCommentThreadsQuery {
  const common = { sort, size: TODO_COMMENT_PAGE_SIZE.THREADS };

  if (pageParam != null) {
    return { ...common, cursor: pageParam };
  }

  return anchorCommentId == null ? common : { ...common, anchorCommentId };
}

export function toRepliesQuery(
  pageParam: TodoCommentPageParam,
  { aroundReplyId }: { aroundReplyId: string | null },
): GetTodoCommentRepliesQuery {
  const common = { size: TODO_COMMENT_PAGE_SIZE.REPLIES };

  if (pageParam != null) {
    return { ...common, cursor: pageParam };
  }

  return aroundReplyId == null ? common : { ...common, aroundReplyId };
}
