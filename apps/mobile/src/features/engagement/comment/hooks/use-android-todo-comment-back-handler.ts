import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { useTodoCommentBack } from './use-todo-comment-back';

/** 화면에 focus가 있을 때만 Android 뒤로가기를 듣고, focus를 잃거나 사라지면 구독을 푼다 */
export function useAndroidTodoCommentBackHandler({ onExit }: { onExit?: () => void } = {}) {
  const { interceptBack } = useTodoCommentBack();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (interceptBack()) {
          return true;
        }
        // 화면이 처리하지 않은 뒤로가기는 pane이면 선택만 풀고, 화면이면 기본 뒤로가기에 맡긴다
        onExit?.();
        return onExit != null;
      });
      return () => subscription.remove();
    }, [interceptBack, onExit]),
  );
}
