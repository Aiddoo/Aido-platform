import { uniqBy } from 'es-toolkit';

import type {
  TodoComment,
  TodoConversationConnection,
  TodoConversationFocus,
  TodoConversationPage,
} from '../../models/todo-comment.model';

export interface TodoCommentConversationRowViewModel {
  comment: TodoComment;
  connection: TodoConversationConnection;
  isFocused: boolean;
  focusContext: TodoCommentConversationFocusContext | null;
}

export interface TodoCommentConversationFocusContext {
  parent: TodoComment;
  connection: TodoConversationConnection;
  earlierAncestorCount: number;
}

export interface TodoCommentConversationViewModel {
  rows: TodoCommentConversationRowViewModel[];
  focus: TodoConversationFocus | null;
}

function getFocus(pages: TodoConversationPage[]): TodoConversationFocus | null {
  return pages.find((page) => page.focus !== null)?.focus ?? null;
}

function getFocusContext(
  comment: TodoComment,
  visibleCommentIds: ReadonlySet<string>,
  focus: TodoConversationFocus | null,
): TodoCommentConversationFocusContext | null {
  if (
    focus === null ||
    focus.commentId !== comment.id ||
    comment.parentId === null ||
    visibleCommentIds.has(comment.parentId)
  ) {
    return null;
  }

  const parentItem = focus.precedingAncestors.at(-1);
  if (parentItem === undefined || parentItem.comment.id !== comment.parentId) {
    return null;
  }

  return {
    parent: parentItem.comment,
    connection: parentItem.connection,
    earlierAncestorCount:
      focus.omittedAncestorCount + Math.max(0, focus.precedingAncestors.length - 1),
  };
}

export function toTodoCommentConversationViewModel(
  pages: TodoConversationPage[],
): TodoCommentConversationViewModel {
  const items = uniqBy(
    pages.flatMap((page) => page.items),
    (item) => item.comment.id,
  );
  const focus = getFocus(pages);
  const visibleCommentIds = new Set(items.map((item) => item.comment.id));

  const rows = items.map((item) => {
    return {
      comment: item.comment,
      connection: item.connection,
      isFocused: item.isFocused,
      focusContext: getFocusContext(item.comment, visibleCommentIds, focus),
    };
  });

  return { rows, focus };
}
