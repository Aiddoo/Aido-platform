import { match } from 'ts-pattern';

import type { TodoCommentComposerMode } from '../../domains/todo-comment-composer.model';

export type TodoCommentBackResult = 'blocked' | 'closeComposer' | 'native';
export type HardwareBackAction = 'consume' | 'exit' | 'native';

/** 작성기가 열려 있으면 먼저 닫고, 아니면 화면을 닫는다. 보내는 중에는 초안을 지키려고 막는다 */
export function getTodoCommentBackResult({
  mode,
  isSubmitting,
}: {
  mode: TodoCommentComposerMode;
  isSubmitting: boolean;
}): TodoCommentBackResult {
  return match({ type: mode.type, isSubmitting })
    .returnType<TodoCommentBackResult>()
    .with({ isSubmitting: true }, () => 'blocked')
    .with({ type: 'new' }, () => 'native')
    .otherwise(() => 'closeComposer');
}

/** 화면이 처리하지 않은 뒤로가기는 pane이면 선택만 풀고, 화면이면 기본 뒤로가기에 맡긴다 */
export function resolveHardwareBackAction({
  isHandledByComment,
  canExit,
}: {
  isHandledByComment: boolean;
  canExit: boolean;
}): HardwareBackAction {
  if (isHandledByComment) {
    return 'consume';
  }

  return canExit ? 'exit' : 'native';
}
