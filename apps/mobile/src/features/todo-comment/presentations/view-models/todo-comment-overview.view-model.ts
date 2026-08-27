import { uniqBy } from 'es-toolkit';

import type {
  TodoCommentOverviewItem,
  TodoCommentOverviewPage,
} from '../../models/todo-comment.model';

export interface TodoCommentOverviewViewModel {
  items: TodoCommentOverviewItem[];
}

export function toTodoCommentOverviewViewModel(
  pages: TodoCommentOverviewPage[],
): TodoCommentOverviewViewModel {
  return {
    items: uniqBy(
      pages.flatMap((page) => page.items),
      (item) => item.comment.id,
    ),
  };
}
