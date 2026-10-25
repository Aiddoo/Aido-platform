import type { TodoCommentSort } from '@aido/api';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useTodoCommentPresentation } from '../components/providers/todo-comment-presentation-provider';
import {
  parseTodoCommentRoute,
  resolveTodoCommentRouteNavigation,
  type TodoCommentRoute,
  type TodoCommentRouteAction,
} from '../utils/navigation/todo-comment-route';

export interface TodoCommentRouteUpdates {
  showOverview: () => void;
  openConversation: (commentId: string) => void;
  startNewComment: () => void;
  startReply: (commentId: string) => void;
  startEdit: (commentId: string) => void;
  cancelForm: () => void;
  completeForm: (focusCommentId?: string) => void;
  changeSort: (sort: TodoCommentSort) => void;
}

export type UseTodoCommentRouteResult = readonly [TodoCommentRoute, TodoCommentRouteUpdates];

/**
 * 댓글 보기 상태를 URL에서 읽는다. 대화 화면은 path의 `commentId`, 개요 화면과 pane은 search의 `comment`가
 * 선택한 댓글이다. 전이는 표시 방식에 맞춰 push·pop 또는 search 변경으로 실행한다.
 */
export function useTodoCommentRoute(): UseTodoCommentRouteResult {
  const { todoId } = useTodoScreenParams();
  const presentation = useTodoCommentPresentation();
  const { sort, comment, commentId, intent, returnTo } = useLocalSearchParams();
  const commentRoute = useMemo(
    () =>
      parseTodoCommentRoute(
        commentId === undefined
          ? { sort, comment, intent, returnTo }
          : // 대화 화면은 항상 대화를 보여 준다. 작성기 intent만 search로 받는다.
            {
              sort,
              comment: commentId,
              intent: intent === 'reply' || intent === 'edit' ? intent : 'thread',
              returnTo,
            },
      ),
    [comment, commentId, intent, returnTo, sort],
  );

  const updateRoute = useCallback(
    (action: TodoCommentRouteAction) => {
      const navigation = resolveTodoCommentRouteNavigation({
        todoId,
        route: commentRoute,
        action,
        presentation,
      });

      if (navigation.type === 'push') {
        router.push(navigation.href);
      } else if (navigation.type === 'back') {
        router.back();
      } else if (navigation.type === 'setParams') {
        router.setParams(navigation.params);
      }
    },
    [commentRoute, presentation, todoId],
  );

  const showOverview = useCallback(() => updateRoute({ type: 'showOverview' }), [updateRoute]);
  const openConversation = useCallback(
    (nextCommentId: string) => updateRoute({ type: 'openConversation', commentId: nextCommentId }),
    [updateRoute],
  );
  const startNewComment = useCallback(
    () => updateRoute({ type: 'startNewComment' }),
    [updateRoute],
  );
  const startReply = useCallback(
    (nextCommentId: string) => updateRoute({ type: 'startReply', commentId: nextCommentId }),
    [updateRoute],
  );
  const startEdit = useCallback(
    (nextCommentId: string) => updateRoute({ type: 'startEdit', commentId: nextCommentId }),
    [updateRoute],
  );
  const cancelForm = useCallback(() => updateRoute({ type: 'cancelForm' }), [updateRoute]);
  const completeForm = useCallback(
    (focusCommentId?: string) => updateRoute({ type: 'completeForm', focusCommentId }),
    [updateRoute],
  );
  const changeSort = useCallback(
    (nextSort: TodoCommentSort) => updateRoute({ type: 'changeSort', sort: nextSort }),
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
