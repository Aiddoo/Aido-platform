import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { TodoComment } from '../../models/todo-comment.model';
import { useTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition';
import { useTodoCommentConversationQueryOptions } from '../queries/use-todo-comment-conversation-query-options';
import { toInitialConversationWindow } from '../utils/comment-conversation-position';
import type { CommentNavigationDestination } from '../utils/comment-route-state';
import type { ConversationPages } from '../utils/todo-comment-cache.util';
import { useCommentRouteState } from './use-comment-route-state';

export function useCommentConversationNavigation(comment: TodoComment) {
  const { todoId } = useTodoScreenParams();
  const route = useCommentRouteState();
  const queryClient = useQueryClient();
  const { error: showError, warning: showWarning } = useAppToast();
  const { t } = useTranslation('todoComment');
  const queryOptions = useTodoCommentConversationQueryOptions({
    todoId,
    sort: route.sort,
    focusCommentId: comment.id,
  });
  const {
    pendingCommentId,
    canNavigateToComment,
    beginCommentNavigation,
    completeCommentNavigation,
  } = useTodoCommentScreenTransition();

  const open = useCallback(
    async (destination: CommentNavigationDestination) => {
      if (!canNavigateToComment(destination)) {
        showWarning(t('toasts.finishComposerFirst'));
        return;
      }

      const requestId = beginCommentNavigation(comment.id, destination);
      if (requestId === null) {
        return;
      }

      if (route.anchorCommentId === comment.id) {
        if (!completeCommentNavigation(requestId)) {
          return;
        }

        if (destination === 'thread') {
          route.showThread(comment.id);
          return;
        }

        if (destination === 'reply') {
          route.startReply(comment.id);
          return;
        }

        route.startEdit(comment.id);
        return;
      }

      try {
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

        await queryClient.fetchInfiniteQuery({
          ...queryOptions,
          pages: 1,
        });
      } catch {
        if (completeCommentNavigation(requestId)) {
          showError(undefined, { fallback: t('toasts.openConversationFailed') });
        }
        return;
      }

      if (!completeCommentNavigation(requestId)) {
        return;
      }

      if (destination === 'thread') {
        route.showThread(comment.id);
        return;
      }

      if (destination === 'reply') {
        route.startReply(comment.id);
        return;
      }

      route.startEdit(comment.id);
    },
    [
      beginCommentNavigation,
      canNavigateToComment,
      comment.id,
      completeCommentNavigation,
      queryClient,
      queryOptions,
      route,
      showError,
      showWarning,
      t,
    ],
  );

  return {
    isPreparing: pendingCommentId === comment.id,
    canOpenEdit: canNavigateToComment('edit'),
    canOpenReply: canNavigateToComment('reply'),
    openThread: () => open('thread'),
    openReply: () => open('reply'),
    openEdit: () => open('edit'),
  };
}
