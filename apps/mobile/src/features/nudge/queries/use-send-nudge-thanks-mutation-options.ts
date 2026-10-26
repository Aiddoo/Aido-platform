import type { SendNudgeThanksInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { invalidateTodoDetails } from '@src/features/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export function useSendNudgeThanksMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ todoId, input }: { todoId: number; input: SendNudgeThanksInput }) =>
      unwrap(await todoNudgeService.sendThanks(todoId, input)),
    onSuccess: async (recipientCount) => {
      if (recipientCount > 0) {
        trackEvent('nudge_thanks_sent', { recipient_count: recipientCount });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() }),
        invalidateNotifications(queryClient),
      ]);
    },
    onError: (error, { todoId }) => {
      if (!isApiError(error)) {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
      }
      toast.error(isApiError(error) ? error.message : undefined, {
        fallback: t('todo:toast.retryLater'),
      });
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
      if (isApiError(error) && error.hasCode(ErrorCode.NUDGE_1110)) {
        invalidateTodoDetails(queryClient, { todoId });
      }
    },
  });
}
