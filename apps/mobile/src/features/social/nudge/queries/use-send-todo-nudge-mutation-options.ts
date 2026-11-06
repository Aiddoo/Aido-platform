import { useHaptics, useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { NUDGE_QUERY_KEYS } from '@src/features/social/nudge/constants/nudge-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isTodoNudgeError } from '../domains/todo-nudge.error';
import type { SendTodoNudgeInput } from '../domains/todo-nudge.model';

export const useSendTodoNudgeMutationOptions = () => {
  const haptics = useHaptics();
  const todoNudgeService = useTodoNudgeService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });

  return mutationOptions({
    mutationFn: async (input: SendTodoNudgeInput) => {
      const result = await todoNudgeService.sendNudge(input);
      return unwrap(result);
    },
    onSuccess: () => {
      haptics.notify('success');
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.limit() });
      invalidateEntitlements(queryClient);
      toast.success(t('todo:toast.nudgeSent'));
      trackEvent('nudge_sent');
    },
    onError: (error) => {
      haptics.notify('error');

      if (gate.handleError(error)) {
        return;
      }

      if (isApiError(error) || isTodoNudgeError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.retryLater') });
    },
  });
};
