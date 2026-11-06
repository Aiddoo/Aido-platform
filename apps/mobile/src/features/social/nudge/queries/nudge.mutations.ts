import { type ReplyToNudgeInput, type SendNudgeThanksInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import {
  useErrorReporter,
  useTodoNudgeService,
  useHaptics,
} from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { NUDGE_QUERY_KEYS } from '@src/features/social/nudge/constants/nudge-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isTodoNudgeError } from '../domains/todo-nudge.error';
import { type SendRemindNudgeInput, type SendTodoNudgeInput } from '../domains/todo-nudge.model';

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

export const useSendRemindNudgeMutationOptions = () => {
  const haptics = useHaptics();
  const todoNudgeService = useTodoNudgeService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: SendRemindNudgeInput) => {
      const result = await todoNudgeService.sendRemindNudge(input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      haptics.notify('success');
      queryClient.invalidateQueries({
        queryKey: NUDGE_QUERY_KEYS.remindCooldown({ userId: variables.receiverId }),
      });
      toast.success(t('todo:toast.remindNudgeSent'));
      trackEvent('remind_nudge_sent');
    },
    onError: (error) => {
      haptics.notify('error');

      if (isApiError(error) || isTodoNudgeError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.retryLater') });
    },
  });
};

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
