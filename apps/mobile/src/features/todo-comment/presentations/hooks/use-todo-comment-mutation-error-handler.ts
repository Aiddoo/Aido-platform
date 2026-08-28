import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { isApiError, isInfraError, toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { useCallback } from 'react';

type TodoCommentMutationOperation = 'create' | 'update' | 'delete' | 'like';

const HTTP_METHOD = {
  create: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
  like: 'PUT/DELETE',
} as const;

export function useTodoCommentMutationErrorHandler({ todoId }: { todoId: number }) {
  const errorReporter = useErrorReporter();
  const toast = useAppToast();
  const { t } = useTranslation('todoComment');

  return useCallback(
    (error: unknown, operation: TodoCommentMutationOperation) => {
      const normalizedError = toError(error);
      const fallbackMessage = {
        create: t('toasts.writeFailed'),
        update: t('toasts.updateFailed'),
        delete: t('toasts.deleteFailed'),
        like: t('toasts.likeFailed'),
      }[operation];

      if (!isApiError(error)) {
        errorReporter.captureException(normalizedError, {
          feature: 'todo_comment',
          endpoint: `v1/todos/${todoId}/comments`,
          method: HTTP_METHOD[operation],
          statusCode: isInfraError(error) ? (error.statusCode ?? undefined) : undefined,
        });
      }

      toast.error(isApiError(error) || isInfraError(error) ? normalizedError : undefined, {
        fallback: fallbackMessage,
      });
    },
    [errorReporter, t, toast, todoId],
  );
}
