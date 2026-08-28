import type { TodoCommentSort } from '@aido/validators';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import {
  parseTodoCommentRoute,
  reduceTodoCommentRoute,
  serializeTodoCommentRoute,
  type TodoCommentRoute,
  type TodoCommentRouteAction,
} from '../navigation/todo-comment-route';

export interface TodoCommentRouteUpdates {
  showOverview: () => void;
  openConversation: (commentId: string) => void;
  startNewComment: () => void;
  startReply: (commentId: string) => void;
  startEdit: (commentId: string) => void;
  cancelForm: () => void;
  completeForm: () => void;
  changeSort: (sort: TodoCommentSort) => void;
}

export type UseTodoCommentRouteResult = readonly [TodoCommentRoute, TodoCommentRouteUpdates];

export function useTodoCommentRoute(): UseTodoCommentRouteResult {
  const { sort, comment, intent, returnTo } = useLocalSearchParams();
  const commentRoute = useMemo(
    () => parseTodoCommentRoute({ sort, comment, intent, returnTo }),
    [comment, intent, returnTo, sort],
  );

  const updateRoute = useCallback(
    (action: TodoCommentRouteAction) => {
      const nextRoute = reduceTodoCommentRoute(commentRoute, action);
      router.setParams(serializeTodoCommentRoute(nextRoute));
    },
    [commentRoute],
  );

  const showOverview = useCallback(() => updateRoute({ type: 'showOverview' }), [updateRoute]);
  const openConversation = useCallback(
    (commentId: string) => updateRoute({ type: 'openConversation', commentId }),
    [updateRoute],
  );
  const startNewComment = useCallback(
    () => updateRoute({ type: 'startNewComment' }),
    [updateRoute],
  );
  const startReply = useCallback(
    (commentId: string) => updateRoute({ type: 'startReply', commentId }),
    [updateRoute],
  );
  const startEdit = useCallback(
    (commentId: string) => updateRoute({ type: 'startEdit', commentId }),
    [updateRoute],
  );
  const cancelForm = useCallback(() => updateRoute({ type: 'cancelForm' }), [updateRoute]);
  const completeForm = useCallback(() => updateRoute({ type: 'completeForm' }), [updateRoute]);
  const changeSort = useCallback(
    (sort: TodoCommentSort) => updateRoute({ type: 'changeSort', sort }),
    [updateRoute],
  );

  const updateCommentRoute = useMemo(
    () => ({
      showOverview,
      openConversation,
      startNewComment,
      startReply,
      startEdit,
      cancelForm,
      completeForm,
      changeSort,
    }),
    [
      cancelForm,
      changeSort,
      completeForm,
      openConversation,
      showOverview,
      startEdit,
      startNewComment,
      startReply,
    ],
  );

  return useMemo(() => [commentRoute, updateCommentRoute], [commentRoute, updateCommentRoute]);
}
