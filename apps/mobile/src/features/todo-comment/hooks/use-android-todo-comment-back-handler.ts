import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { useTodoCommentBack } from './use-todo-comment-back';

export function useAndroidTodoCommentBackHandler() {
  const { handleBack } = useTodoCommentBack();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
      return () => subscription.remove();
    }, [handleBack]),
  );
}
