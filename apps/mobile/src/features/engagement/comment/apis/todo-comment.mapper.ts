import type {
  DeleteTodoCommentResponse,
  TodoCommentLikeResponse,
} from '@aido/api/contracts/todo-comment/v1';
import type {
  GetTodoCommentRepliesQuery,
  GetTodoCommentThreadsQuery,
  TodoComment as TodoCommentDto,
  TodoCommentRepliesResponse,
  TodoCommentThread as TodoCommentThreadDto,
  TodoCommentThreadsResponse,
} from '@aido/api/contracts/todo-comment/v2';
import type { TodoCommentSort } from '@aido/api/vocabulary';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import { TODO_COMMENT_PAGE_SIZE } from '../constants/todo-comment.constants';
import { getTrimmedContent } from '../domains/todo-comment-composer.model';
import type {
  TodoCommentReplyPage,
  TodoCommentThread,
  TodoCommentThreadPage,
} from '../domains/todo-comment-thread.model';
import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
} from '../domains/todo-comment.model';
import type { TodoCommentFormValues } from '../schemas/todo-comment-form.schema';
import type { TodoCommentChainInput } from '../schemas/todo-comment-request.schema';
import type {
  WrittenTodoCommentChainResponse,
  WrittenTodoCommentMutationResponse,
  WrittenTodoCommentResponse,
} from '../schemas/todo-comment-response.schema';

function toTodoComment(dto: TodoCommentDto): TodoComment {
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

/** 첫 페이지(cursor 없음)만 anchor로 위치를 찾고, 이어지는 페이지는 서버가 준 cursor를 그대로 보낸다 */
export function toThreadsQuery(
  cursor: string | null,
  { sort, anchorCommentId }: { sort: TodoCommentSort; anchorCommentId: string | null },
): GetTodoCommentThreadsQuery {
  const common = { sort, size: TODO_COMMENT_PAGE_SIZE.THREADS };

  if (cursor != null) {
    return { ...common, cursor };
  }

  return anchorCommentId == null ? common : { ...common, anchorCommentId };
}

export function toRepliesQuery(
  cursor: string | null,
  { aroundReplyId }: { aroundReplyId: string | null },
): GetTodoCommentRepliesQuery {
  const common = { size: TODO_COMMENT_PAGE_SIZE.REPLIES };

  if (cursor != null) {
    return { ...common, cursor };
  }

  return aroundReplyId == null ? common : { ...common, aroundReplyId };
}

/** 보낼 글은 앞뒤 공백을 지운 값이다. 칸이 하나도 없으면 null */
export function toTrimmedContents(
  items: TodoCommentFormValues['items'],
): [string, ...string[]] | null {
  const [first, ...rest] = items.map((item) => getTrimmedContent(item.content));
  return first == null ? null : [first, ...rest];
}

/** 보낸 글 묶음과 그 내용 지문. 지문이 같으면 같은 요청을 다시 쓴다 */
export interface TodoCommentChainSubmission {
  fingerprint: string;
  request: TodoCommentChainInput;
}

interface TodoCommentChainSubmissionInput {
  previousSubmission: TodoCommentChainSubmission | null;
  todoId: number;
  parentId: string | null;
  contents: readonly [string, ...string[]];
  createClientRequestId: () => string;
}

/** 같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다 */
export function toTodoCommentChainSubmission({
  previousSubmission,
  todoId,
  parentId,
  contents,
  createClientRequestId,
}: TodoCommentChainSubmissionInput): TodoCommentChainSubmission {
  const fingerprint = JSON.stringify([todoId, parentId, contents]);

  if (previousSubmission?.fingerprint === fingerprint) {
    return previousSubmission;
  }

  const [firstContent, ...remainingContents] = contents;
  const toItem = (content: string) => ({ clientRequestId: createClientRequestId(), content });

  return {
    fingerprint,
    request: { parentId, items: [toItem(firstContent), ...remainingContents.map(toItem)] },
  };
}
