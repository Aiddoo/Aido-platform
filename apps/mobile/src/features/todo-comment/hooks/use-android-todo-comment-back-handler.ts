import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { resolveHardwareBackAction } from '../utils/navigation/todo-comment-back';
import { useTodoCommentBack } from './use-todo-comment-back';

interface AndroidTodoCommentBackHandlerOptions {
  /** 댓글 화면이 더 되돌릴 단계가 없을 때 호출한다. 라우트를 pop하지 않는 pane이 선택을 해제하는 데 쓴다. */
  onExit?: () => void;
}

export function useAndroidTodoCommentBackHandler({
  onExit,
}: AndroidTodoCommentBackHandlerOptions = {}) {
  const { handleBack } = useTodoCommentBack();

  useFocusEffect(
    useCallback(() => {
      const handleHardwareBack = () => {
        const action = resolveHardwareBackAction({
          isHandledByComment: handleBack(),
          canExit: onExit != null,
        });

        if (action === 'exit') {
          onExit?.();
        }
        return action !== 'native';
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => subscription.remove();
    }, [handleBack, onExit]),
  );
}
