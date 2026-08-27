import type { TodoCommentSort } from '@aido/validators';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import {
  type CommentNavigationDestination,
  parseCommentRouteState,
} from '../utils/comment-route-state';

export function useCommentRouteState() {
  const state = parseCommentRouteState(useLocalSearchParams());
  const { mode, anchorCommentId } = state;
  const setSort = useCallback((nextSort: TodoCommentSort) => {
    router.setParams({ sort: nextSort });
  }, []);
  const openComment = useCallback(
    (commentId: string, destination: CommentNavigationDestination) => {
      router.setParams({ comment: commentId, intent: destination });
    },
    [],
  );
  const startCreate = useCallback(() => {
    router.setParams({ comment: undefined, intent: 'create' });
  }, []);
  const closeComposer = useCallback(() => {
    if (mode === 'reply' || mode === 'edit') {
      router.setParams({ comment: anchorCommentId, intent: 'thread' });
      return;
    }

    if (mode === 'create') {
      router.setParams({ comment: undefined, intent: undefined });
    }
  }, [anchorCommentId, mode]);
  const clearThread = useCallback(() => {
    router.setParams({ comment: undefined, intent: undefined });
  }, []);

  return {
    ...state,
    setSort,
    openComment,
    startCreate,
    closeComposer,
    clearThread,
  };
}
