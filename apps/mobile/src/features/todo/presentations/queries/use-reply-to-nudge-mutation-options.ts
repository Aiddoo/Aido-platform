import type { ReplyToNudgeInput } from '@aido/validators';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useTranslation } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function useReplyToNudgeMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { t } = useTranslation('todo');

  return mutationOptions({
    mutationFn: async ({ nudgeId, input }: { nudgeId: number; input: ReplyToNudgeInput }) =>
      unwrap(await todoNudgeService.replyToNudge(nudgeId, input)),
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(TODO_QUERY_KEYS.nudgeInteraction(variables.nudgeId), data);
      toast.success(t('interaction.replySent'));
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
