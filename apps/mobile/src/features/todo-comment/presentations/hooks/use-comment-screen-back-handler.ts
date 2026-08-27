import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';

import { useCancelTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition';
import { getCommentScreenBackAction } from '../utils/comment-screen-back-action';
import { useCommentRouteState } from './use-comment-route-state';
import { useIsTodoCommentComposerMutating } from './use-is-todo-comment-composer-mutating';

export function useCommentScreenBackHandler(): void {
  const { mode, closeComposer, clearThread } = useCommentRouteState();
  const isSubmitting = useIsTodoCommentComposerMutating();
  const cancelPendingTransition = useCancelTodoCommentScreenTransition();
  const action = getCommentScreenBackAction({ mode, isSubmitting });
  const closeActiveComposer = useCallback(() => {
    cancelPendingTransition();
    KeyboardController.dismiss({ animated: false }).catch(() => undefined);
    closeComposer();
  }, [cancelPendingTransition, closeComposer]);
  const showCommentOverview = useCallback(() => {
    cancelPendingTransition();
    KeyboardController.dismiss({ animated: false }).catch(() => undefined);
    clearThread();
  }, [cancelPendingTransition, clearThread]);

  useFocusEffect(
    useCallback(() => {
      const handleHardwareBack = () => {
        if (action === 'native') {
          cancelPendingTransition();
          return false;
        }

        if (action === 'close-composer') {
          closeActiveComposer();
        } else if (action === 'clear-thread') {
          showCommentOverview();
        }

        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => subscription.remove();
    }, [action, cancelPendingTransition, closeActiveComposer, showCommentOverview]),
  );
}
