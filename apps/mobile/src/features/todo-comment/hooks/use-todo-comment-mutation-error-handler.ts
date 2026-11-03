import { ErrorCode } from '@aido/api/errors';
import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { isApiError, isInfraError, toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';

import type { TodoComment } from '../domains/todo-comment.model';
import { removeTodoCommentFromCaches } from '../queries/todo-comment-cache';

type TodoCommentMutationOperation = 'create' | 'update' | 'delete' | 'like';

const HTTP_METHOD = {
  create: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
  like: 'PUT/DELETE',
} as const;

const TOO_MANY_REQUESTS_STATUS = 429;

/**
 * 예측한 오류는 한 번만 알린다. 이미 지워졌거나 볼 수 없는 글이면 그 행을 캐시에서 빼고,
 * 너무 자주 보내면 잠시 뒤 다시 하라고 알린다.
 */
export function useTodoCommentMutationErrorHandler({ todoId }: { todoId: number }) {
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');

  return useCallback(
    (error: unknown, operation: TodoCommentMutationOperation, target?: TodoComment) => {
      const fallback = match(operation)
        .with('create', () => t('toasts.writeFailed'))
        .with('update', () => t('toasts.updateFailed'))
        .with('delete', () => t('toasts.deleteFailed'))
        .with('like', () => t('toasts.likeFailed'))
        .exhaustive();

      match(error)
        .when(
          (value) =>
            isApiError(value) &&
            (value.hasCode(ErrorCode.TODO_0833) || value.hasCode(ErrorCode.TODO_0831)),
          () => {
            if (target != null) {
              removeTodoCommentFromCaches({ queryClient, todoId, comment: target });
            }
            toast.warning(t('toasts.alreadyDeleted'));
          },
        )
        .when(
          (value) => isApiError(value) && value.status === TOO_MANY_REQUESTS_STATUS,
          () => toast.warning(t('toasts.throttled')),
        )
        .with(P.when(isApiError), (apiError) => toast.error(apiError, { fallback }))
        .otherwise((unknownError) => {
          const normalizedError = toError(unknownError);
          errorReporter.captureException(normalizedError, {
            feature: 'todo_comment',
            endpoint: `v1/todos/${todoId}/comments`,
            method: HTTP_METHOD[operation],
            statusCode: isInfraError(unknownError)
              ? (unknownError.statusCode ?? undefined)
              : undefined,
          });
          toast.error(isInfraError(unknownError) ? normalizedError : undefined, { fallback });
        });
    },
    [errorReporter, queryClient, t, toast, todoId],
  );
}
