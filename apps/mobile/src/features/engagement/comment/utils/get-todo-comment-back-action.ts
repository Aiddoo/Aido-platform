import { match } from 'ts-pattern';

import type { TodoCommentComposerMode } from '../schemas/todo-comment-form.schema';

type TodoCommentBackAction = 'blocked' | 'closeComposer' | 'native';

/** 작성기가 열려 있으면 먼저 닫고, 아니면 화면을 닫는다. 보내는 중에는 초안을 지키려고 막는다 */
export function getTodoCommentBackAction(
  mode: Pick<TodoCommentComposerMode, 'type'>,
  { isSubmitting }: { isSubmitting: boolean },
): TodoCommentBackAction {
  return match({ type: mode.type, isSubmitting })
    .returnType<TodoCommentBackAction>()
    .with({ isSubmitting: true }, () => 'blocked')
    .with({ type: 'new' }, () => 'native')
    .otherwise(() => 'closeComposer');
}
