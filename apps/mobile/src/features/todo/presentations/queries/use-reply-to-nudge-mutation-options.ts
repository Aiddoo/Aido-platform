import type { ReplyToNudgeInput } from '@aido/api';
import { useErrorReporter, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

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
      queryClient.setQueryData(TODO_QUERY_KEYS.nudgeInteraction(variables.nudgeId), data);
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
