import { useLogger } from '@src/bootstrap/providers/di-context';
import { useCallback, useMemo } from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';

import {
  getTodoCommentBackResult,
  type TodoCommentBackResult,
} from '../navigation/todo-comment-back';
import { useCancelTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition-provider';
import { useIsTodoCommentSubmitting } from './use-is-todo-comment-submitting';
import { useTodoCommentRoute } from './use-todo-comment-route';

interface TodoCommentBack {
  result: TodoCommentBackResult;
  handleBack: () => boolean;
}

export function useTodoCommentBack(): TodoCommentBack {
  const [commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const logger = useLogger();
  const isSubmitting = useIsTodoCommentSubmitting();
  const cancelPendingTransition = useCancelTodoCommentScreenTransition();
  const result = useMemo(
    () => getTodoCommentBackResult({ route: commentRoute, isSubmitting }),
    [commentRoute, isSubmitting],
  );

  const handleBack = useCallback(() => {
    if (result.status === 'blocked') {
      return true;
    }

    cancelPendingTransition();

    if (result.status === 'native') {
      return false;
    }

    KeyboardController.dismiss({ animated: false }).catch((error) =>
      logger.warn('[TodoComment] Keyboard dismiss failed', { error }),
    );

    if (result.destination === 'overview') {
      updateCommentRoute.showOverview();
    } else if (commentRoute.view === 'conversation') {
      updateCommentRoute.openConversation(commentRoute.commentId);
    }

    return true;
  }, [cancelPendingTransition, commentRoute, logger, result, updateCommentRoute]);

  return { result, handleBack };
}
