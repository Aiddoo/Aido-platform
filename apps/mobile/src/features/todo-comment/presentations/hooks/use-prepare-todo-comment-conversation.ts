import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useTodoCommentConversationQueryOptions } from '../queries/use-todo-comment-conversation-query-options';
import { toInitialConversationWindow } from '../utils/comment-conversation-position';
import type { ConversationPages } from '../utils/todo-comment-cache.util';
import { useCommentRouteState } from './use-comment-route-state';

export function usePrepareTodoCommentConversation(commentId: string) {
  const { todoId } = useTodoScreenParams();
  const { sort } = useCommentRouteState();
  const queryClient = useQueryClient();
  const queryOptions = useTodoCommentConversationQueryOptions({
    todoId,
    sort,
    focusCommentId: commentId,
  });

  return useCallback(async () => {
    const cachedData = queryClient.getQueryData<ConversationPages>(queryOptions.queryKey);
    const cachedState = queryClient.getQueryState<ConversationPages>(queryOptions.queryKey);
    const initialWindow =
      cachedData === undefined ? undefined : toInitialConversationWindow(cachedData);

    if (initialWindow === null) {
      queryClient.removeQueries({ queryKey: queryOptions.queryKey, exact: true });
    } else if (initialWindow !== undefined && initialWindow !== cachedData) {
      queryClient.setQueryData<ConversationPages>(queryOptions.queryKey, initialWindow, {
        updatedAt: cachedState?.dataUpdatedAt,
      });
      await queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
        exact: true,
        refetchType: 'none',
      });
    }

    await queryClient.fetchInfiniteQuery({ ...queryOptions, pages: 1 });
  }, [queryClient, queryOptions]);
}
