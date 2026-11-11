import { selectPageItems } from '@src/shared/domains/cursor-page.model';
import type { InfiniteData } from '@tanstack/react-query';
import { compact } from 'es-toolkit';

import {
  type TodoComment,
  TodoCommentPolicy,
  type TodoCommentReplyPage,
  type TodoCommentThread,
  type TodoCommentThreadPage,
} from '../domains/todo-comment.model';

/** null은 첫 페이지(또는 anchor 페이지), 문자열은 서버가 방향을 담아 준 cursor다 */
export type TodoCommentPageParam = string | null;
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

function mapPreservingIdentity<T>(items: readonly T[], transform: (item: T) => T): readonly T[] {
  const nextItems = items.map(transform);

  return nextItems.some((nextItem, index) => nextItem !== items[index]) ? nextItems : items;
}

function mapPages<TPage extends { items: readonly unknown[] }>(
  data: InfiniteData<TPage, TodoCommentPageParam>,
  transformPage: (page: TPage) => TPage,
): InfiniteData<TPage, TodoCommentPageParam> {
  const pages = mapPreservingIdentity(data.pages, transformPage);
  return pages === data.pages ? data : { ...data, pages: [...pages] };
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
  const comment = patchComment(thread.comment, commentId, transform);
  const previewReply =
    thread.previewReply == null ? null : patchComment(thread.previewReply, commentId, transform);

  return comment === thread.comment && previewReply === thread.previewReply
    ? thread
    : { ...thread, comment, previewReply };
}

export function patchCommentInThreadPages(
  data: TodoCommentThreadPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => {
    const items = mapPreservingIdentity(page.items, (thread) =>
      patchThread(thread, commentId, transform),
    );
    return items === page.items ? page : { ...page, items: [...items] };
  });
}

export function patchCommentInReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentReplyPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => {
    const items = mapPreservingIdentity(page.items, (reply) =>
      patchComment(reply, commentId, transform),
    );
    return items === page.items ? page : { ...page, items: [...items] };
  });
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

  return mapPages(data, (page) => {
    const items = compact(
      page.items.map((thread) => TodoCommentPolicy.withCommentRemoved(thread, removed)),
    );
    const isUnchanged =
      items.length === page.items.length &&
      items.every((thread, index) => thread === page.items[index]);
    return isUnchanged ? page : { ...page, items };
  });
}

export function removeCommentFromReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
): TodoCommentReplyPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => {
    const items = TodoCommentPolicy.withRepliesRemoved(page.items, commentId);
    return items.length === page.items.length ? page : { ...page, items };
  });
}

export function addRepliesToThreadPages(
  data: TodoCommentThreadPages | undefined,
  threadCommentId: string,
  replies: readonly TodoComment[],
): TodoCommentThreadPages | undefined {
  if (data == null) {
    return data;
  }

  return mapPages(data, (page) => {
    const items = mapPreservingIdentity(page.items, (thread) =>
      thread.comment.id === threadCommentId
        ? TodoCommentPolicy.withReplyAdded(thread, replies)
        : thread,
    );
    return items === page.items ? page : { ...page, items: [...items] };
  });
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

  return mapPages(data, (page) => {
    const items = mapPreservingIdentity(page.items, (thread) => {
      if (thread.comment.id !== threadId) {
        return thread;
      }
      return removed.id === threadId
        ? { ...thread, comment: removed }
        : TodoCommentPolicy.withReplyAdded(thread, [removed]);
    });
    return items === page.items ? page : { ...page, items: [...items] };
  });
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
