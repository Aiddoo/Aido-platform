import { TODO_COMMENT_SORT } from '@aido/validators';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTrack } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { TodoCommentSort } from '../../models/todo-comment.model';
import {
  usePendingTodoCommentTransition,
  useTodoCommentScreenTransitionActions,
} from '../providers/todo-comment-screen-transition-provider';
import { useTodoCommentOverviewQueryOptions } from '../queries/use-todo-comment-overview-query-options';
import { useTodoCommentRoute } from './use-todo-comment-route';

interface TodoCommentSortState {
  sort: TodoCommentSort;
  isChangingSort: boolean;
  changeSort: (sort: TodoCommentSort) => void;
}

export function useTodoCommentSort(): TodoCommentSortState {
  const { todoId } = useTodoScreenParams();
  const [commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const { warning: showWarning } = useAppToast();
  const { t } = useTranslation('todoComment');
  const { startSortChange, finishTransition } = useTodoCommentScreenTransitionActions();
  const pendingTransition = usePendingTodoCommentTransition();

  const overviewOptionsBySort = {
    [TODO_COMMENT_SORT.POPULAR]: useTodoCommentOverviewQueryOptions({
      todoId,
      sort: TODO_COMMENT_SORT.POPULAR,
    }),
    [TODO_COMMENT_SORT.LATEST]: useTodoCommentOverviewQueryOptions({
      todoId,
      sort: TODO_COMMENT_SORT.LATEST,
    }),
  };

  const changeSort = useCallback(
    (nextSort: TodoCommentSort) => {
      const startResult = startSortChange({ nextSort });

      if (startResult.status === 'blocked') {
        showWarning(t('toasts.finishFormFirst'));
        return;
      }

      if (startResult.status !== 'started') {
        return;
      }

      const prefetchAndCommitSort = async () => {
        try {
          await queryClient.prefetchInfiniteQuery(overviewOptionsBySort[nextSort]);
        } catch {
          // URL 전환 뒤 기존 query error UI에서 일관되게 재시도할 수 있게 한다.
        }

        if (finishTransition(startResult.transition).status === 'stale') {
          return;
        }

        updateCommentRoute.changeSort(nextSort);
        trackEvent('todo_comment_sorted', { todo_id: todoId, sort: nextSort });
      };

      prefetchAndCommitSort().catch((error) =>
        logger.error('[TodoComment] Sort change failed', toError(error)),
      );
    },
    [
      finishTransition,
      logger,
      overviewOptionsBySort,
      queryClient,
      showWarning,
      startSortChange,
      t,
      todoId,
      trackEvent,
      updateCommentRoute,
    ],
  );

  return {
    sort: commentRoute.sort,
    isChangingSort: pendingTransition?.type === 'sortChange',
    changeSort,
  };
}
