import { useLogger } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useCallback } from 'react';
import { useWatch } from 'react-hook-form';
import { KeyboardController } from 'react-native-keyboard-controller';
import { match } from 'ts-pattern';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import { EMPTY_TODO_COMMENT_FORM_VALUES } from '../schemas/todo-comment-form.schema';
import { getTodoCommentBackAction } from '../utils/todo-comment-back.view-model';
import { useIsTodoCommentSubmitting } from './use-is-todo-comment-submitting';
import { useTodoCommentForm } from './use-todo-comment-form';

/** Header back과 Android back이 같은 순서로 동작한다. 작성기를 닫았으면 true를 돌려준다 */
export function useTodoCommentBack() {
  const logger = useLogger();
  const { control, reset } = useTodoCommentForm();
  const mode = useWatch({ control, name: 'mode' });
  const isSubmitting = useIsTodoCommentSubmitting();
  const backAction = getTodoCommentBackAction(mode, { isSubmitting });

  const interceptBack = useCallback(
    () =>
      match(backAction)
        .with('blocked', () => true)
        .with('native', () => false)
        .with('closeComposer', () => {
          KeyboardController.dismiss({ animated: false }).catch((error) =>
            logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
              error: getErrorMessage(error),
            }),
          );
          reset(EMPTY_TODO_COMMENT_FORM_VALUES);
          return true;
        })
        .exhaustive(),
    [logger, reset, backAction],
  );

  return { backAction, interceptBack };
}
