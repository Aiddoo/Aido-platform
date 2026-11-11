import { useHaptics, useTodoNudgeApi } from '@src/bootstrap/providers/di-context';
import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { invalidateTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isThanksTodoNotCompletedError } from '../domains/todo-nudge.error';
import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  ReplyToNudgeInput,
  SendNudgeThanksInput,
} from '../schemas/nudge-request.schema';
import { invalidateNudgeInteractions } from './todo-nudge-cache';
import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';

export function useReplyToNudgeMutationOptions() {
  const todoNudgeApi = useTodoNudgeApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 화면에 머물며 답장 버튼이 응답까지 꺼진다. 오프라인에 멈춰 두면 연결되는 순간 몰래 보내므로 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ nudgeId, input }: { nudgeId: number; input: ReplyToNudgeInput }) =>
      unwrap(await todoNudgeApi.replyToNudge(nudgeId, input)),
    onSuccess: (data, variables) => {
      trackEvent('nudge_replied', { reply_kind: variables.input.replyKind });
      queryClient.setQueryData(
        TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId: variables.nudgeId }),
        data,
      );
      emitNotificationsChanged();
      invalidateNudgeInteractions(queryClient);
    },
    onError: () => {
      invalidateNudgeInteractions(queryClient);
    },
    meta: { errorFeedback: { feature: 'todo_nudge', fallbackKey: 'todo:toast.retryLater' } },
  });
}

export function useSendNudgeThanksMutationOptions() {
  const todoNudgeApi = useTodoNudgeApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 감사 버튼이 응답까지 돈다. 답장과 같은 이유로 오프라인에서 멈추지 않는다
    networkMode: 'always',
    mutationFn: async ({ todoId, input }: { todoId: number; input: SendNudgeThanksInput }) =>
      unwrap(await todoNudgeApi.sendThanks(todoId, input)),
    onSuccess: (recipientCount) => {
      if (recipientCount > 0) {
        trackEvent('nudge_thanks_sent', { recipient_count: recipientCount });
      }
      emitNotificationsChanged();
      invalidateNudgeInteractions(queryClient);
    },
    onError: (error, { todoId }) => {
      invalidateNudgeInteractions(queryClient);
      if (isThanksTodoNotCompletedError(error)) {
        invalidateTodoDetails(queryClient, { todoId });
      }
    },
    meta: { errorFeedback: { feature: 'todo_nudge', fallbackKey: 'todo:toast.retryLater' } },
  });
}

export function useSendRemindNudgeMutationOptions() {
  const haptics = useHaptics();
  const todoNudgeApi = useTodoNudgeApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 저장 후 떠나는 시트라 오프라인에서도 멈춰 기다리지 않고 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (input: CreateRemindNudgeInput) =>
      unwrap(await todoNudgeApi.sendRemindNudge(input)),
    onSuccess: (_data, variables) => {
      haptics.notify('success');
      queryClient.invalidateQueries({
        queryKey: TODO_NUDGE_QUERY_KEYS.remindCooldown({ userId: variables.receiverId }),
      });
      toast.success(t('todo:toast.remindNudgeSent'));
      trackEvent('remind_nudge_sent');
    },
    meta: { errorFeedback: { feature: 'todo_nudge', fallbackKey: 'todo:toast.retryLater' } },
  });
}

export function useSendTodoNudgeMutationOptions() {
  const haptics = useHaptics();
  const todoNudgeApi = useTodoNudgeApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: CreateNudgeInput) => unwrap(await todoNudgeApi.sendNudge(input)),
    onSuccess: () => {
      haptics.notify('success');
      queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.limit() });
      invalidateEntitlements(queryClient);
      toast.success(t('todo:toast.nudgeSent'));
      trackEvent('nudge_sent');
    },
    onError: (error) => {
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
      }
    },
    // 할 일 상세의 콕 버튼은 서버가 계산한 permissions.canNudge를 따른다
    onSettled: (_data, _error, { todoId }) => {
      invalidateTodoDetails(queryClient, { todoId });
    },
    meta: {
      errorFeedback: {
        feature: 'todo_nudge',
        fallbackKey: 'todo:toast.retryLater',
        isHandledByFeature: isLimitedFeatureError,
      },
    },
  });
}
