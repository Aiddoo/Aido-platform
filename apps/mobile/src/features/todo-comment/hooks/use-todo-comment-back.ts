import { useLogger } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { KeyboardController } from 'react-native-keyboard-controller';
import { match } from 'ts-pattern';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import {
  type TodoCommentComposerForm,
  TodoCommentComposer,
} from '../domains/todo-comment-composer.model';
import { getTodoCommentBackResult } from '../utils/navigation/todo-comment-back';
import { useIsTodoCommentSubmitting } from './use-is-todo-comment-submitting';

/** Header back과 Android back이 같은 순서로 동작한다. 작성기를 닫았으면 true를 돌려준다 */
export function useTodoCommentBack() {
  const logger = useLogger();
  const { control, reset } = useFormContext<TodoCommentComposerForm>();
  const mode = useWatch({ control, name: 'mode' });
  const isSubmitting = useIsTodoCommentSubmitting();
  const result = getTodoCommentBackResult({ mode, isSubmitting });

  const handleBack = useCallback(
    () =>
      match(result)
        .with('blocked', () => true)
        .with('native', () => false)
        .with('closeComposer', () => {
          KeyboardController.dismiss({ animated: false }).catch((error) =>
            logger.warn(TODO_COMMENT_LOG_EVENT.KEYBOARD_DISMISS_FAILED, {
              error: getErrorMessage(error),
            }),
          );
          reset(TodoCommentComposer.new());
          return true;
        })
        .exhaustive(),
    [logger, reset, result],
  );

  return { result, handleBack };
}
