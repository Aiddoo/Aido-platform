import { useTodoNudgeService } from '@src/bootstrap/providers/di-provider';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { isTodoNudgeError } from '../../models/todo-nudge.error';
import type { SendRemindNudgeInput } from '../../models/todo-nudge.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const useSendRemindNudgeMutationOptions = () => {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({
        queryKey: TODO_QUERY_KEYS.remindNudgeCooldown(variables.receiverId),
      });
      toast.success('할일 만들라고 콕 찔렀어요!');
      trackEvent('remind_nudge_sent');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) || isTodoNudgeError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
    },
  });
};
