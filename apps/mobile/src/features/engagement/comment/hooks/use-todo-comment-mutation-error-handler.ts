import { useErrorReporter, useHaptics } from '@src/bootstrap/providers/di-context';
import { ApiError, getUserFacingMessage, isInfraError, toError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import {
  isTodoCommentRateLimitedError,
  isTodoCommentUnavailableError,
} from '../domains/todo-comment.error';
import { removeTodoCommentFromCaches } from '../queries/todo-comment-cache';
import type { TodoComment } from '../schemas/todo-comment.schema';

type TodoCommentMutationOperation = 'create' | 'update' | 'delete' | 'like';

const HTTP_METHOD = {
  create: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
  like: 'PUT/DELETE',
} as const;

/**
 * 예측한 오류는 한 번만 알린다. 이미 지워졌거나 볼 수 없는 글이면 그 행을 캐시에서 빼고,
 * 너무 자주 보내면 잠시 뒤 다시 하라고 알린다.
 */
export function useTodoCommentMutationErrorHandler({ todoId }: { todoId: number }) {
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');

  return (error: unknown, operation: TodoCommentMutationOperation, target: TodoComment | null) => {
    const fallback = match(operation)
      .with('create', () => t('toasts.writeFailed'))
      .with('update', () => t('toasts.updateFailed'))
      .with('delete', () => t('toasts.deleteFailed'))
      .with('like', () => t('toasts.likeFailed'))
      .exhaustive();

    match(error)
      .when(isTodoCommentUnavailableError, () => {
        if (target != null) {
          removeTodoCommentFromCaches({ queryClient, todoId, comment: target });
        }
        toast.warning(t('toasts.alreadyDeleted'));
      })
      .when(isTodoCommentRateLimitedError, () => toast.warning(t('toasts.throttled')))
      .with(P.instanceOf(ApiError), (apiError) => {
        haptics.notify('error');
        toast.error(getUserFacingMessage(apiError), { fallback });
      })
      .otherwise((unknownError) => {
        errorReporter.captureException(toError(unknownError), {
          feature: 'todo_comment',
          endpoint: `v1/todos/${todoId}/comments`,
          method: HTTP_METHOD[operation],
          statusCode: isInfraError(unknownError)
            ? (unknownError.statusCode ?? undefined)
            : undefined,
        });
        haptics.notify('error');
        toast.error(getUserFacingMessage(unknownError), { fallback });
      });
  };
}
