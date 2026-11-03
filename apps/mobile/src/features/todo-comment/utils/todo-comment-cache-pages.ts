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

function mapPreservingIdentity<T>(items: readonly T[], transform: (item: T) => T): readonly T[] {
  let changed = false;
  const nextItems = items.map((item) => {
    const nextItem = transform(item);
    changed ||= nextItem !== item;
    return nextItem;
  });

  return changed ? nextItems : items;
}

function mapPages<TPage extends { items: readonly unknown[] }>(
  data: InfiniteData<TPage, TodoCommentPageParam>,
  transformPage: (page: TPage) => TPage,
): InfiniteData<TPage, TodoCommentPageParam> {
  const pages = mapPreservingIdentity(data.pages, transformPage);
  return pages === data.pages ? data : { ...data, pages: [...pages] };
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
): TodoComment | undefined {
  for (const thread of data?.pages.flatMap((page) => page.items) ?? []) {
    const comment = TodoCommentPolicy.findCommentInThread(thread, commentId);
    if (comment != null) {
      return comment;
    }
  }
  return undefined;
}

export function findCommentInReplyPages(
  data: TodoCommentReplyPages | undefined,
  commentId: string,
): TodoComment | undefined {
  return data?.pages.flatMap((page) => page.items).find((reply) => reply.id === commentId);
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

/** 다음 페이지가 남았으면 그 페이지가 순서대로 가져온다. 끝까지 읽은 목록만 새 답글을 끝에 붙인다 */
export function appendRepliesToReplyPages(
  data: TodoCommentReplyPages | undefined,
  replies: readonly TodoComment[],
): TodoCommentReplyPages | undefined {
  const lastPage = data?.pages.at(-1);
  if (data == null || lastPage == null || lastPage.pagination.hasNext) {
    return data;
  }

  return {
    ...data,
    pages: [...data.pages.slice(0, -1), { ...lastPage, items: [...lastPage.items, ...replies] }],
  };
}
