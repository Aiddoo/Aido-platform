import type { SendNudgeThanksInput } from '@aido/validators';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function useSendNudgeThanksMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { t } = useTranslation('todo');

  return mutationOptions({
    mutationFn: async ({ todoId, input }: { todoId: number; input: SendNudgeThanksInput }) =>
      unwrap(await todoNudgeService.sendThanks(todoId, input)),
    onSuccess: async (data) => {
      toast.success(t(data > 0 ? 'interaction.thanksSent' : 'interaction.alreadyThanked'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeInteractions() }),
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
      ]);
    },
    onError: (error) => {
      if (isApiError(error)) {
        toast.error(error.message);
      } else {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
        toast.error(t('toast.retryLater'));
      }
      void queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeInteractions() });
    },
  });
}
