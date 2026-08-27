import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { useCallback } from 'react';

import type { TodoComment } from '../../models/todo-comment.model';
import { useTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition';
import type { CommentNavigationDestination } from '../utils/comment-route-state';
import { useCommentRouteState } from './use-comment-route-state';
import { usePrepareTodoCommentConversation } from './use-prepare-todo-comment-conversation';

export function useCommentConversationNavigation(comment: TodoComment) {
  const { anchorCommentId, openComment } = useCommentRouteState();
  const { error: showError, warning: showWarning } = useAppToast();
  const { t } = useTranslation('todoComment');
  const prepareConversation = usePrepareTodoCommentConversation(comment.id);
  const {
    pendingCommentId,
    canNavigateToComment,
    beginCommentNavigation,
    completeCommentNavigation,
  } = useTodoCommentScreenTransition();

  const commitNavigation = useCallback(
    (requestId: number, destination: CommentNavigationDestination) => {
      if (!completeCommentNavigation(requestId)) {
        return false;
      }

      openComment(comment.id, destination);
      return true;
    },
    [comment.id, completeCommentNavigation, openComment],
  );

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

      if (anchorCommentId === comment.id) {
        commitNavigation(requestId, destination);
        return;
      }

      try {
        await prepareConversation();
      } catch {
        if (completeCommentNavigation(requestId)) {
          showError(undefined, { fallback: t('toasts.openConversationFailed') });
        }
        return;
      }

      commitNavigation(requestId, destination);
    },
    [
      beginCommentNavigation,
      canNavigateToComment,
      anchorCommentId,
      comment.id,
      commitNavigation,
      completeCommentNavigation,
      prepareConversation,
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
