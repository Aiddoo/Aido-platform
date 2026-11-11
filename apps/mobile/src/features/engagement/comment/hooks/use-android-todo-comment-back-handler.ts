import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';

import { useTodoCommentBack } from './use-todo-comment-back';

/** 화면에 focus가 있을 때만 듣는다 */
export function useAndroidTodoCommentBackHandler({ onExit }: { onExit?: () => void } = {}) {
  const { interceptBack } = useTodoCommentBack();
  useAndroidBackHandler({
    onBack: () => {
      if (interceptBack()) {
        return true;
      }
      // 화면이 처리하지 않은 뒤로가기는 pane이면 선택만 풀고, 화면이면 기본 뒤로가기에 맡긴다
      onExit?.();
      return onExit != null;
    },
  });
}
