import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';

import { EMPTY_TODO_COMMENT_FORM_VALUES } from '../schemas/todo-comment-form.schema';
import { getTodoCommentBackAction } from '../utils/todo-comment-back.view-model';
import { useIsTodoCommentSubmitting } from './use-is-todo-comment-submitting';
import { useTodoCommentForm } from './use-todo-comment-form';

/** Header back과 Android back이 같은 순서로 동작한다. 작성기를 닫았으면 true를 돌려준다 */
export function useTodoCommentBack() {
  const dismissKeyboard = useDismissKeyboard();
  const { control, reset } = useTodoCommentForm();
  const mode = useWatch({ control, name: 'mode' });
  const isSubmitting = useIsTodoCommentSubmitting();
  const backAction = getTodoCommentBackAction(mode, { isSubmitting });

  const interceptBack = () =>
    match(backAction)
      .with('blocked', () => true)
      .with('native', () => false)
      .with('closeComposer', () => {
        dismissKeyboard({ animated: false });
        reset(EMPTY_TODO_COMMENT_FORM_VALUES);
        return true;
      })
      .exhaustive();

  return { backAction, interceptBack };
}
