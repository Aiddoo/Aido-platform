import { TODO_COMMENT_SORT } from '@aido/validators';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTrack } from '@src/shared/analytics';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { TodoCommentSort } from '../../models/todo-comment.model';
import { useTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition';
import { useTodoCommentOverviewQueryOptions } from '../queries/use-todo-comment-overview-query-options';
import { useCommentRouteState } from './use-comment-route-state';

interface PendingSortTransition {
  requestId: number;
  routeIdentity: string;
}

export function useCommentSortTransition() {
  const { todoId } = useTodoScreenParams();
  const { sort, mode, anchorCommentId, setSort } = useCommentRouteState();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { beginSortTransition, completeSortTransition } = useTodoCommentScreenTransition();
  const isMountedRef = useRef(true);
  const routeIdentity = `${todoId}:${sort}:${mode}:${anchorCommentId ?? 'none'}`;
  const [pendingTransition, setPendingTransition] = useState<PendingSortTransition | null>(null);
  const isSwitching = pendingTransition?.routeIdentity === routeIdentity;

  const commentsOptionsBySort = {
    [TODO_COMMENT_SORT.POPULAR]: useTodoCommentOverviewQueryOptions({
      todoId,
      sort: TODO_COMMENT_SORT.POPULAR,
    }),
    [TODO_COMMENT_SORT.LATEST]: useTodoCommentOverviewQueryOptions({
      todoId,
      sort: TODO_COMMENT_SORT.LATEST,
    }),
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const switchSort = async (next: TodoCommentSort) => {
    if (next === sort || isSwitching) {
      return;
    }

    const requestId = beginSortTransition();
    if (requestId === null) {
      return;
    }

    const transition = { requestId, routeIdentity };
    setPendingTransition(transition);

    try {
      await queryClient.prefetchInfiniteQuery(commentsOptionsBySort[next]);
    } catch {
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      const isCurrent = completeSortTransition(transition.requestId);
      setPendingTransition((current) =>
        current?.requestId === transition.requestId ? null : current,
      );
      if (!isCurrent) {
        return;
      }

      setSort(next);
      trackEvent('todo_comment_sorted', { todo_id: todoId, sort: next });
    }
  };

  return { sort, isSwitching, switchSort };
}
