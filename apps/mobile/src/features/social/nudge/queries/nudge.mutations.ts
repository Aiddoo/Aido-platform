import {
  useErrorReporter,
  useTodoNudgeService,
  useHaptics,
} from '@src/bootstrap/providers/di-context';
import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError, unwrap } from '@src/shared/errors';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NUDGE_QUERY_KEYS } from '../constants/nudge-query-keys';
import { isNudgeTodoChanged } from '../domains/todo-nudge.error';
import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  ReplyToNudgeInput,
  SendNudgeThanksInput,
} from '../schemas/nudge-request.schema';

export function useReplyToNudgeMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const showFailure = useMutationFailure(t('todo:toast.retryLater'));

  return mutationOptions({
    mutationFn: async ({ nudgeId, input }: { nudgeId: number; input: ReplyToNudgeInput }) =>
      unwrap(await todoNudgeService.replyToNudge(nudgeId, input)),
    onSuccess: async (data, variables) => {
      trackEvent('nudge_replied', { reply_kind: variables.input.replyKind });
      queryClient.setQueryData(NUDGE_QUERY_KEYS.interaction({ nudgeId: variables.nudgeId }), data);
      emitNotificationsChanged();
      await queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
    },
    onError: (error) => {
      if (!isApiError(error)) {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
      }
      showFailure(error);
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
    },
  });
}

export function useSendNudgeThanksMutationOptions() {
  const todoNudgeService = useTodoNudgeService();
  const errorReporter = useErrorReporter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const showFailure = useMutationFailure(t('todo:toast.retryLater'));

  return mutationOptions({
    mutationFn: async ({ todoId, input }: { todoId: number; input: SendNudgeThanksInput }) =>
      unwrap(await todoNudgeService.sendThanks(todoId, input)),
    onSuccess: async (recipientCount) => {
      if (recipientCount > 0) {
        trackEvent('nudge_thanks_sent', { recipient_count: recipientCount });
      }
      emitNotificationsChanged();
      await queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
    },
    onError: (error, { todoId }) => {
      if (!isApiError(error)) {
        errorReporter.captureException(toError(error), { feature: 'todo_nudge' });
      }
      showFailure(error);
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
      if (isNudgeTodoChanged(error)) {
        invalidateTodoDetails(queryClient, { todoId });
      }
    },
  });
}

export function useSendRemindNudgeMutationOptions() {
  const haptics = useHaptics();
  const todoNudgeService = useTodoNudgeService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('todo:toast.retryLater'));

  return mutationOptions({
    // 저장 후 떠나는 시트라 오프라인에서도 멈춰 기다리지 않고 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (input: CreateRemindNudgeInput) =>
      unwrap(await todoNudgeService.sendRemindNudge(input)),
    onSuccess: (_data, variables) => {
      haptics.notify('success');
      queryClient.invalidateQueries({
        queryKey: NUDGE_QUERY_KEYS.remindCooldown({ userId: variables.receiverId }),
      });
      toast.success(t('todo:toast.remindNudgeSent'));
      trackEvent('remind_nudge_sent');
    },
    onError: (error) => {
      showFailure(error);
    },
  });
}

export function useSendTodoNudgeMutationOptions() {
  const haptics = useHaptics();
  const todoNudgeService = useTodoNudgeService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });
  const showFailure = useMutationFailure(t('todo:toast.retryLater'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: CreateNudgeInput) => unwrap(await todoNudgeService.sendNudge(input)),
    onSuccess: () => {
      haptics.notify('success');
      queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.limit() });
      invalidateEntitlements(queryClient);
      toast.success(t('todo:toast.nudgeSent'));
      trackEvent('nudge_sent');
    },
    onError: (error) => {
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
        return;
      }

      showFailure(error);
    },
  });
}
