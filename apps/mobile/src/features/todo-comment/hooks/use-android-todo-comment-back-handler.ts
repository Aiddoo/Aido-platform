import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { resolveHardwareBackAction } from '../utils/navigation/todo-comment-back';
import { useTodoCommentBack } from './use-todo-comment-back';

/** 화면에 focus가 있을 때만 Android 뒤로가기를 듣고, focus를 잃거나 사라지면 구독을 푼다 */
export function useAndroidTodoCommentBackHandler({ onExit }: { onExit?: () => void } = {}) {
  const { handleBack } = useTodoCommentBack();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const action = resolveHardwareBackAction({
          isHandledByComment: handleBack(),
          canExit: onExit != null,
        });

        if (action === 'exit') {
          onExit?.();
        }
        return action !== 'native';
      });
      return () => subscription.remove();
    }, [handleBack, onExit]),
  );
}
