import { TODO_COMMENT_SORT } from '@aido/validators';
import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoCommentSort, TodoConversationPage } from '../../models/todo-comment.model';
import {
  TODO_COMMENT_QUERY_KEYS,
  TODO_COMMENT_QUERY_TIMING,
} from '../constants/todo-comment-query-keys.constant';
import {
  getNextTodoCommentPageParam,
  getPreviousTodoCommentPageParam,
  INITIAL_TODO_COMMENT_PAGE_PARAM,
  type TodoCommentCursorPageParam,
  toTodoCommentConversationQuery,
} from '../utils/todo-comment-cursor-page';
import {
  toTodoCommentConversationViewModel,
  type TodoCommentConversationViewModel,
} from '../view-models/todo-comment-conversation.view-model';

function selectTodoCommentConversation(
  data: InfiniteData<TodoConversationPage, TodoCommentCursorPageParam>,
): TodoCommentConversationViewModel {
  return toTodoCommentConversationViewModel(data.pages);
}

export function useTodoCommentConversationQueryOptions({
  todoId,
  sort,
  focusCommentId,
}: {
  todoId: number;
  sort: TodoCommentSort;
  focusCommentId?: string;
}) {
  const todoCommentService = useTodoCommentService();

  return infiniteQueryOptions({
    queryKey: TODO_COMMENT_QUERY_KEYS.conversation({ todoId, sort, focusCommentId }),
    initialPageParam: INITIAL_TODO_COMMENT_PAGE_PARAM,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoCommentService.getConversation(
          todoId,
          toTodoCommentConversationQuery(pageParam, sort, focusCommentId),
          signal,
        ),
      ),
    getPreviousPageParam: (firstPage) => getPreviousTodoCommentPageParam(firstPage.pagination),
    getNextPageParam: (lastPage) => getNextTodoCommentPageParam(lastPage.pagination),
    staleTime:
      sort === TODO_COMMENT_SORT.POPULAR
        ? TODO_COMMENT_QUERY_TIMING.popularStaleTime
        : TODO_COMMENT_QUERY_TIMING.latestStaleTime,
    gcTime: TODO_COMMENT_QUERY_TIMING.gcTime,
    select: selectTodoCommentConversation,
  });
}
