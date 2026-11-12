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
import {
  invalidateNudgeInteraction,
  invalidateNudgeInteractionLists,
  invalidateNudgeInteractions,
  invalidateNudgeLimit,
  invalidateRemindNudgeCooldown,
  setNudgeInteractionInCache,
} from './todo-nudge-cache';

export function useReplyToNudgeMutationOptions() {
  const todoNudgeApi = useTodoNudgeApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 화면에 머물며 답장 버튼이 응답까지 꺼진다. 오프라인에 멈춰 두면 연결되는 순간 몰래 보내므로 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ nudgeId, input }: { nudgeId: number; input: ReplyToNudgeInput }) =>
      unwrap(await todoNudgeApi.replyToNudge(nudgeId, input)),
    onSuccess: (nudge, { input }) => {
      trackEvent('nudge_replied', { reply_kind: input.replyKind });
      setNudgeInteractionInCache(queryClient, nudge);
      emitNotificationsChanged();
    },
    // 이미 답했거나 사라진 콕이면 상세를 서버 값으로 맞춘다. 성공하면 방금 쓴 상세는 다시 받지 않는다
    onError: (_error, { nudgeId }) => {
      invalidateNudgeInteraction(queryClient, { nudgeId });
    },
    onSettled: () => invalidateNudgeInteractionLists(queryClient),
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
    },
    onError: (error, { todoId }) => {
      if (isThanksTodoNotCompletedError(error)) {
        invalidateTodoDetails(queryClient, { todoId });
      }
    },
    // 감사는 그 할 일에 온 콕 모두의 기록을 바꿔 답장·감사를 넓게 다시 받는다
    onSettled: () => invalidateNudgeInteractions(queryClient),
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
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('todo:toast.remindNudgeSent'));
      trackEvent('remind_nudge_sent');
    },
    onSettled: (_data, _error, { receiverId }) =>
      invalidateRemindNudgeCooldown(queryClient, { userId: receiverId }),
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
      toast.success(t('todo:toast.nudgeSent'));
      trackEvent('nudge_sent');
    },
    onError: (error) => {
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
      }
    },
    // 할 일 상세의 콕 버튼은 서버가 계산한 permissions.canNudge를 따른다
    onSettled: (_data, _error, { todoId }) =>
      Promise.all([
        invalidateNudgeLimit(queryClient),
        invalidateEntitlements(queryClient),
        invalidateTodoDetails(queryClient, { todoId }),
      ]),
    meta: {
      errorFeedback: {
        feature: 'todo_nudge',
        fallbackKey: 'todo:toast.retryLater',
        isHandledByFeature: isLimitedFeatureError,
      },
    },
  });
}
