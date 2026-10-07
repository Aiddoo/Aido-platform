import type { SendNudgeThanksInput } from '@aido/api';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function useSendNudgeThanksMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: { todoId: number; input: SendNudgeThanksInput }) =>
      unwrap(await todoNudgeService.sendThanks(todoId, input)),
    onSuccess: async (recipientCount) => {
      if (recipientCount > 0) trackEvent('nudge_thanks_sent', { recipient_count: recipientCount });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeInteractions() }),
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
      ]);
    },
    onError: (error) => {
      if (!isApiError(error)) {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
      }
      void queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeInteractions() });
    },
  });
}
