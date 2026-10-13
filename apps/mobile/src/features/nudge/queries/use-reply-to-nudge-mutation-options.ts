import type { ReplyToNudgeInput } from '@aido/api';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export function useReplyToNudgeMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: async ({ nudgeId, input }: { nudgeId: number; input: ReplyToNudgeInput }) =>
      unwrap(await todoNudgeService.replyToNudge(nudgeId, input)),
    onSuccess: async (data, variables) => {
      trackEvent('nudge_replied', { reply_kind: variables.input.replyKind });
      queryClient.setQueryData(NUDGE_QUERY_KEYS.interaction({ nudgeId: variables.nudgeId }), data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() }),
        invalidateNotifications(queryClient),
      ]);
    },
    onError: (error) => {
      if (!isApiError(error)) {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
      }
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
    },
  });
}
