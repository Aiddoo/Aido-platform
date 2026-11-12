import { selectPageItems } from '@src/shared/domains/cursor-page.model';
import type { InfiniteData } from '@tanstack/react-query';
import { compact } from 'es-toolkit';

import {
  type TodoComment,
  type TodoCommentPagination,
  TodoCommentPolicy,
  type TodoCommentReplyPage,
  type TodoCommentThread,
  type TodoCommentThreadPage,
} from '../domains/todo-comment.model';

/** null은 첫 페이지(또는 anchor 페이지), 문자열은 서버가 방향을 담아 준 cursor다 */
export type TodoCommentPageParam = string | null;

export const INITIAL_TODO_COMMENT_PAGE_PARAM: TodoCommentPageParam = null;

export function getNextTodoCommentPageParam({
  hasNext,
  nextCursor,
}: Pick<TodoCommentPagination, 'hasNext' | 'nextCursor'>) {
  return hasNext && nextCursor != null ? nextCursor : undefined;
}

export function getPreviousTodoCommentPageParam({
  hasPrevious,
  previousCursor,
}: Pick<TodoCommentPagination, 'hasPrevious' | 'previousCursor'>) {
  return hasPrevious && previousCursor != null ? previousCursor : undefined;
}
export type TodoCommentThreadPages = InfiniteData<TodoCommentThreadPage, TodoCommentPageParam>;
export type TodoCommentReplyPages = InfiniteData<TodoCommentReplyPage, TodoCommentPageParam>;
export type TodoCommentTransform = (comment: TodoComment) => TodoComment;

/** 지운 댓글이 있던 자리. 지우기가 실패하면 그 댓글만 이 자리에 되돌린다 */
export interface TodoCommentPlacement {
  pageIndex: number;
  index: number;
}

/** 지운 댓글을 담았던 묶음과 그 자리. 묶음이 통째로 빠졌으면 이 묶음을 다시 넣는다 */
export interface TodoCommentThreadPlacement extends TodoCommentPlacement {
  thread: TodoCommentThread;
}

/** 바뀌지 않은 페이지·묶음의 참조는 setQueriesData가 구조 공유로 되돌리므로 여기서는 새로 만들어도 된다 */
function mapPages<TPage extends { items: readonly unknown[] }>(
  data: InfiniteData<TPage, TodoCommentPageParam>,
  transformPage: (page: TPage) => TPage,
): InfiniteData<TPage, TodoCommentPageParam> {
  return { ...data, pages: data.pages.map(transformPage) };
}

function findPlacement<TItem>(
  data: InfiniteData<{ items: readonly TItem[] }, TodoCommentPageParam> | undefined,
  isTarget: (item: TItem) => boolean,
): TodoCommentPlacement | null {
  for (const [pageIndex, page] of (data?.pages ?? []).entries()) {
    const index = page.items.findIndex(isTarget);
    if (index !== -1) {
      return { pageIndex, index };
    }
  }
  return null;
}

/** 그 자리에 다시 넣는다. 그사이 페이지가 줄었으면 마지막 페이지에 넣는다 */
function withItemInserted<TItem, TPage extends { items: TItem[] }>(
  data: InfiniteData<TPage, TodoCommentPageParam>,
  { pageIndex, index }: TodoCommentPlacement,
  item: TItem,
): InfiniteData<TPage, TodoCommentPageParam> {
  const targetPageIndex = Math.min(pageIndex, data.pages.length - 1);
  return {
    ...data,
    pages: data.pages.map((page, currentPageIndex) =>
      currentPageIndex === targetPageIndex
        ? { ...page, items: [...page.items.slice(0, index), item, ...page.items.slice(index)] }
        : page,
    ),
  };
}

function patchComment(comment: TodoComment, commentId: string, transform: TodoCommentTransform) {
  return comment.id === commentId ? transform(comment) : comment;
}

function patchThread(
  thread: TodoCommentThread,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentThread {
  return {
    ...thread,
    comment: patchComment(thread.comment, commentId, transform),
    previewReply:
      thread.previewReply == null ? null : patchComment(thread.previewReply, commentId, transform),
  };
}

export function patchCommentInThreadPages(
  data: TodoCommentThreadPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => ({
    ...page,
    items: page.items.map((thread) => patchThread(thread, commentId, transform)),
  }));
}

export function patchCommentInReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentReplyPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => ({
    ...page,
    items: page.items.map((reply) => patchComment(reply, commentId, transform)),
  }));
}

export function findCommentInThreadPages(
  data: TodoCommentThreadPages | undefined,
  commentId: string,
): TodoComment | null {
  for (const thread of selectPageItems(data ?? { pages: [] })) {
    const comment = TodoCommentPolicy.findCommentInThread(thread, commentId);
    if (comment != null) {
      return comment;
    }
  }
  return null;
}

export function findCommentInReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
): TodoComment | null {
  return selectPageItems(data ?? { pages: [] }).find((reply) => reply.id === commentId) ?? null;
}

export function removeCommentFromThreadPages(
  data: TodoCommentThreadPages | undefined,
  removed: TodoComment,
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => ({
    ...page,
    items: compact(
      page.items.map((thread) => TodoCommentPolicy.withCommentRemoved(thread, removed)),
    ),
  }));
}

export function removeCommentFromReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
): TodoCommentReplyPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => ({
    ...page,
    items: TodoCommentPolicy.withRepliesRemoved(page.items, commentId),
  }));
}

export function addRepliesToThreadPages(
  data: TodoCommentThreadPages | undefined,
  threadCommentId: string,
  replies: readonly TodoComment[],
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => ({
    ...page,
    items: page.items.map((thread) =>
      thread.comment.id === threadCommentId
        ? TodoCommentPolicy.withReplyAdded(thread, replies)
        : thread,
    ),
  }));
}

/** 방금 쓴 답글은 마지막 페이지 끝에 붙여 바로 보인다. 남은 페이지를 받으면 flattenReplies가 작성 순 자리로 옮긴다 */
export function appendRepliesToReplyPages(
  data: TodoCommentReplyPages | undefined,
  replies: readonly TodoComment[],
): TodoCommentReplyPages | undefined {
  const lastPage = data?.pages.at(-1);
  if (data == null || lastPage == null) {
    return data;
  }

  return {
    ...data,
    pages: [...data.pages.slice(0, -1), { ...lastPage, items: [...lastPage.items, ...replies] }],
  };
}

/** 지울 댓글을 담은 묶음(댓글 자신이거나 답글이 달린 묶음) */
export function findThreadPlacement(
  data: TodoCommentThreadPages | undefined,
  comment: TodoComment,
): TodoCommentThreadPlacement | null {
  const isContainingThread = (thread: TodoCommentThread) =>
    thread.comment.id === comment.id || thread.comment.id === comment.threadCommentId;
  const placement = findPlacement(data, isContainingThread);
  const thread =
    placement == null ? null : data?.pages[placement.pageIndex]?.items[placement.index];

  return placement == null || thread == null ? null : { ...placement, thread };
}

export function findReplyPlacement(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
): TodoCommentPlacement | null {
  return findPlacement(data, (reply) => reply.id === commentId);
}

/**
 * 지운 댓글 하나만 지금 캐시에 되돌린다. 묶음이 남아 있으면 지운 댓글을 다시 세우거나 답글 수를 되돌리고,
 * 통째로 빠졌으면 지우기 전 묶음을 원래 자리에 넣는다. 같은 묶음의 다른 변경은 남는다
 */
export function restoreCommentInThreadPages(
  data: TodoCommentThreadPages | undefined,
  removed: TodoComment,
  placement: TodoCommentThreadPlacement,
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }
  const threadId = placement.thread.comment.id;
  if (findPlacement(data, (thread) => thread.comment.id === threadId) == null) {
    return withItemInserted(data, placement, placement.thread);
  }

  return mapPages(data, (page) => ({
    ...page,
    items: page.items.map((thread) => {
      // 지우는 사이 서버 값으로 다시 받아 답글이 이미 보이면 답글 수를 또 늘리지 않는다
      if (thread.comment.id !== threadId || thread.previewReply?.id === removed.id) {
        return thread;
      }
      return removed.id === threadId
        ? { ...thread, comment: removed }
        : TodoCommentPolicy.withReplyAdded(thread, [removed]);
    }),
  }));
}

export function restoreCommentInReplyPages(
  data: TodoCommentReplyPages | undefined,
  removed: TodoComment,
  placement: TodoCommentPlacement,
): TodoCommentReplyPages | undefined {
  if (data == null || findReplyPlacement(data, removed.id) != null) {
    return data;
  }
  return withItemInserted(data, placement, removed);
}
