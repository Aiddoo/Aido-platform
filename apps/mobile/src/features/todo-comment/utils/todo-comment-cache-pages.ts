import type { InfiniteData } from '@tanstack/react-query';

import type {
  TodoComment,
  TodoCommentOverviewItem,
  TodoCommentOverviewPage,
  TodoConversationItem,
  TodoConversationPage,
} from '../domains/todo-comment.model';
import type { TodoCommentCursorPageParam } from './todo-comment-cursor-page';

export type OverviewPages = InfiniteData<TodoCommentOverviewPage, TodoCommentCursorPageParam>;
export type ConversationPages = InfiniteData<TodoConversationPage, TodoCommentCursorPageParam>;
export type TodoCommentTransform = (comment: TodoComment) => TodoComment;

function mapPreservingIdentity<T>(items: T[], transform: (item: T) => T): T[] {
  let changed = false;
  const nextItems = items.map((item) => {
    const nextItem = transform(item);
    changed ||= nextItem !== item;
    return nextItem;
  });

  return changed ? nextItems : items;
}

function patchConversationItem(
  item: TodoConversationItem,
  commentId: string,
  transform: TodoCommentTransform,
): TodoConversationItem {
  if (item.comment.id !== commentId) {
    return item;
  }

  const comment = transform(item.comment);
  return comment === item.comment ? item : { ...item, comment };
}

function patchOverviewItem(
  item: TodoCommentOverviewItem,
  commentId: string,
  transform: TodoCommentTransform,
): TodoCommentOverviewItem {
  const comment = item.comment.id === commentId ? transform(item.comment) : item.comment;
  const previewReply =
    item.previewReply?.id === commentId ? transform(item.previewReply) : item.previewReply;

  return comment === item.comment && previewReply === item.previewReply
    ? item
    : { ...item, comment, previewReply };
}

export function findTodoCommentInConversationPages(
  cachedPages: ConversationPages | undefined,
  commentId: string,
): TodoComment | undefined {
  if (cachedPages == null) {
    return undefined;
  }

  for (const page of cachedPages.pages) {
    const conversationItem = page.items.find(({ comment }) => comment.id === commentId);
    if (conversationItem != null) {
      return conversationItem.comment;
    }

    const ancestor = page.focus?.precedingAncestors.find(({ comment }) => comment.id === commentId);
    if (ancestor != null) {
      return ancestor.comment;
    }
  }

  return undefined;
}

export function findTodoCommentInOverviewPages(
  cachedPages: OverviewPages | undefined,
  commentId: string,
): TodoComment | undefined {
  if (cachedPages == null) {
    return undefined;
  }

  for (const page of cachedPages.pages) {
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

export function patchTodoCommentConversationPages(
  cachedPages: ConversationPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): ConversationPages | undefined {
  if (cachedPages == null) {
    return undefined;
  }

  const pages = mapPreservingIdentity(cachedPages.pages, (page) => {
    const items = mapPreservingIdentity(page.items, (item) =>
      patchConversationItem(item, commentId, transform),
    );
    let focus = page.focus;

    if (page.focus != null) {
      const precedingAncestors = mapPreservingIdentity(page.focus.precedingAncestors, (item) =>
        patchConversationItem(item, commentId, transform),
      );
      if (precedingAncestors !== page.focus.precedingAncestors) {
        focus = { ...page.focus, precedingAncestors };
      }
    }

    return items === page.items && focus === page.focus ? page : { ...page, items, focus };
  });

  return pages === cachedPages.pages ? cachedPages : { ...cachedPages, pages };
}

export function patchTodoCommentOverviewPages(
  cachedPages: OverviewPages | undefined,
  commentId: string,
  transform: TodoCommentTransform,
): OverviewPages | undefined {
  if (cachedPages == null) {
    return undefined;
  }

  const pages = mapPreservingIdentity(cachedPages.pages, (page) => {
    const items = mapPreservingIdentity(page.items, (item) =>
      patchOverviewItem(item, commentId, transform),
    );
    return items === page.items ? page : { ...page, items };
  });

  return pages === cachedPages.pages ? cachedPages : { ...cachedPages, pages };
}
