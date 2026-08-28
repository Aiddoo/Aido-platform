import { useLogger } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { useCallback } from 'react';

import type { TodoComment } from '../../models/todo-comment.model';
import type { TodoCommentNavigationDestination } from '../navigation/todo-comment-route';
import type { TodoCommentNavigationTransition } from '../navigation/todo-comment-screen-transition';
import {
  usePendingTodoCommentTransition,
  useTodoCommentScreenTransitionActions,
} from '../providers/todo-comment-screen-transition-provider';
import { usePrepareTodoCommentConversation } from './use-prepare-todo-comment-conversation';
import { useTodoCommentRoute } from './use-todo-comment-route';

interface TodoCommentNavigation {
  isPreparing: boolean;
  canStartEdit: boolean;
  canStartReply: boolean;
  openConversation: () => void;
  startReply: () => void;
  startEdit: () => void;
}

export function useTodoCommentNavigation(comment: TodoComment): TodoCommentNavigation {
  const [commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const logger = useLogger();
  const { error: showError, warning: showWarning } = useAppToast();
  const { t } = useTranslation('todoComment');
  const prepareConversation = usePrepareTodoCommentConversation(comment.id);
  const pendingTransition = usePendingTodoCommentTransition();
  const { getCommentNavigationAvailability, startCommentNavigation, finishTransition } =
    useTodoCommentScreenTransitionActions();

  const commitNavigation = useCallback(
    (
      transition: TodoCommentNavigationTransition,
      destination: TodoCommentNavigationDestination,
    ) => {
      const finishResult = finishTransition(transition);

      if (finishResult.status === 'stale') {
        return false;
      }

      if (destination === 'conversation') {
        updateCommentRoute.openConversation(comment.id);
      } else if (destination === 'reply') {
        updateCommentRoute.startReply(comment.id);
      } else {
        updateCommentRoute.startEdit(comment.id);
      }

      return true;
    },
    [comment.id, finishTransition, updateCommentRoute],
  );

  const navigate = useCallback(
    async (destination: TodoCommentNavigationDestination) => {
      const startResult = startCommentNavigation({ commentId: comment.id, destination });

      if (startResult.status === 'blocked') {
        showWarning(t('toasts.finishFormFirst'));
        return;
      }

      if (startResult.status === 'ignored') {
        return;
      }

      const { transition } = startResult;
      const isCurrentConversation =
        commentRoute.view === 'conversation' && commentRoute.commentId === comment.id;

      if (isCurrentConversation) {
        commitNavigation(transition, destination);
        return;
      }

      try {
        await prepareConversation();
      } catch {
        if (finishTransition(transition).status === 'committed') {
          showError(undefined, { fallback: t('toasts.openConversationFailed') });
        }
        return;
      }

      commitNavigation(transition, destination);
    },
    [
      comment.id,
      commentRoute,
      commitNavigation,
      finishTransition,
      prepareConversation,
      showError,
      showWarning,
      startCommentNavigation,
      t,
    ],
  );

  const requestNavigation = useCallback(
    (destination: TodoCommentNavigationDestination) => {
      navigate(destination).catch((error) =>
        logger.error('[TodoComment] Navigation failed', toError(error)),
      );
    },
    [logger, navigate],
  );
  const openConversation = useCallback(
    () => requestNavigation('conversation'),
    [requestNavigation],
  );
  const startReply = useCallback(() => requestNavigation('reply'), [requestNavigation]);
  const startEdit = useCallback(() => requestNavigation('edit'), [requestNavigation]);

  return {
    isPreparing:
      pendingTransition?.type === 'commentNavigation' && pendingTransition.commentId === comment.id,
    canStartEdit: getCommentNavigationAvailability('edit').status === 'available',
    canStartReply: getCommentNavigationAvailability('reply').status === 'available',
    openConversation,
    startReply,
    startEdit,
  };
}
