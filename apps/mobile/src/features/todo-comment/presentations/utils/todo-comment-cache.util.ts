import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type {
  TodoComment,
  TodoCommentOverviewItem,
  TodoCommentOverviewPage,
  TodoConversationItem,
  TodoConversationPage,
} from '../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import type { TodoCommentCursorPageParam } from './todo-comment-cursor-page';

export type OverviewPages = InfiniteData<TodoCommentOverviewPage, TodoCommentCursorPageParam>;
export type ConversationPages = InfiniteData<TodoConversationPage, TodoCommentCursorPageParam>;
export type CommentPatch = (comment: TodoComment) => TodoComment;

function mapPreservingIdentity<T>(items: T[], transform: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    const transformed = transform(item);
    changed ||= transformed !== item;
    return transformed;
  });
  return changed ? next : items;
}

function patchConversationItem(
  item: TodoConversationItem,
  commentId: string,
  patch: CommentPatch,
): TodoConversationItem {
  if (item.comment.id !== commentId) {
    return item;
  }

  const comment = patch(item.comment);
  return comment === item.comment ? item : { ...item, comment };
}

function patchOverviewItem(
  item: TodoCommentOverviewItem,
  commentId: string,
  patch: CommentPatch,
): TodoCommentOverviewItem {
  const comment = item.comment.id === commentId ? patch(item.comment) : item.comment;
  const previewReply =
    item.previewReply?.id === commentId ? patch(item.previewReply) : item.previewReply;

  return comment === item.comment && previewReply === item.previewReply
    ? item
    : { ...item, comment, previewReply };
}

function findInConversationPages(
  data: ConversationPages | undefined,
  commentId: string,
): TodoComment | undefined {
  if (data === undefined) {
    return undefined;
  }

  for (const page of data.pages) {
    const item = page.items.find(({ comment }) => comment.id === commentId);
    if (item !== undefined) {
      return item.comment;
    }

    const ancestor = page.focus?.precedingAncestors.find(({ comment }) => comment.id === commentId);
    if (ancestor !== undefined) {
      return ancestor.comment;
    }
  }

  return undefined;
}

function findInOverviewPages(
  data: OverviewPages | undefined,
  commentId: string,
): TodoComment | undefined {
  if (data === undefined) {
    return undefined;
  }

  for (const page of data.pages) {
    for (const item of page.items) {
      if (item.comment.id === commentId) {
        return item.comment;
      }
      if (item.previewReply?.id === commentId) {
        return item.previewReply;
      }
    }
  }

  return undefined;
}

export function findCommentInCache(
  queryClient: QueryClient,
  todoId: number,
  commentId: string,
): TodoComment | undefined {
  const conversations = queryClient.getQueriesData<ConversationPages>({
    queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId),
  });

  for (const [, data] of conversations) {
    const comment = findInConversationPages(data, commentId);
    if (comment !== undefined) {
      return comment;
    }
  }

  const overviews = queryClient.getQueriesData<OverviewPages>({
    queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId),
  });

  for (const [, data] of overviews) {
    const comment = findInOverviewPages(data, commentId);
    if (comment !== undefined) {
      return comment;
    }
  }

  return undefined;
}

export function patchConversationPages(
  data: ConversationPages | undefined,
  commentId: string,
  patch: CommentPatch,
): ConversationPages | undefined {
  if (data === undefined) {
    return undefined;
  }

  const pages = mapPreservingIdentity(data.pages, (page) => {
    const items = mapPreservingIdentity(page.items, (item) =>
      patchConversationItem(item, commentId, patch),
    );
    let focus = page.focus;

    if (page.focus !== null) {
      const precedingAncestors = mapPreservingIdentity(page.focus.precedingAncestors, (item) =>
        patchConversationItem(item, commentId, patch),
      );
      if (precedingAncestors !== page.focus.precedingAncestors) {
        focus = { ...page.focus, precedingAncestors };
      }
    }

    return items === page.items && focus === page.focus ? page : { ...page, items, focus };
  });

  return pages === data.pages ? data : { ...data, pages };
}

export function patchOverviewPages(
  data: OverviewPages | undefined,
  commentId: string,
  patch: CommentPatch,
): OverviewPages | undefined {
  if (data === undefined) {
    return undefined;
  }

  const pages = mapPreservingIdentity(data.pages, (page) => {
    const items = mapPreservingIdentity(page.items, (item) =>
      patchOverviewItem(item, commentId, patch),
    );
    return items === page.items ? page : { ...page, items };
  });

  return pages === data.pages ? data : { ...data, pages };
}

export function patchCommentEverywhere(
  queryClient: QueryClient,
  todoId: number,
  commentId: string,
  patch: CommentPatch,
): void {
  queryClient.setQueriesData<ConversationPages>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.conversations(todoId) },
    (data) => patchConversationPages(data, commentId, patch),
  );
  queryClient.setQueriesData<OverviewPages>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.overviews(todoId) },
    (data) => patchOverviewPages(data, commentId, patch),
  );
}
