import { useTodoCommentService } from '@src/bootstrap/providers/di-context';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getTodoCommentConversationQueryOptions } from '../queries/get-todo-comment-conversation-query-options';
import { toInitialConversationWindow } from '../utils/comment-conversation-position';
import type { ConversationPages } from '../utils/todo-comment-cache-pages';
import { useTodoCommentRoute } from './use-todo-comment-route';

/** 고른 댓글을 focus한 대화의 첫 window를 확정한다. URL을 바꾸기 전에 기다려 진입 뒤 목록이 다시 움직이지 않게 한다. */
export function usePrepareTodoCommentConversation() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const todoCommentService = useTodoCommentService();
  const queryClient = useQueryClient();

  return useCallback(
    async (commentId: string) => {
      const queryOptions = getTodoCommentConversationQueryOptions(todoCommentService, {
        todoId,
        sort: commentRoute.sort,
        focusCommentId: commentId,
      });
      const cachedData = queryClient.getQueryData<ConversationPages>(queryOptions.queryKey);
      const cachedState = queryClient.getQueryState<ConversationPages>(queryOptions.queryKey);
      const initialWindow =
        cachedData == null ? undefined : toInitialConversationWindow(cachedData);

      // nullish-strict: undefined는 캐시 없음, null은 쓸 수 없는 캐시라 지운다
      if (initialWindow === null) {
        queryClient.removeQueries({ queryKey: queryOptions.queryKey, exact: true });
      } else if (initialWindow != null && initialWindow !== cachedData) {
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
    },
    [commentRoute.sort, queryClient, todoCommentService, todoId],
  );
}
