import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isTodoNudgeError } from '../domains/todo-nudge.error';
import type { SendRemindNudgeInput } from '../domains/todo-nudge.model';

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
      notifySuccess();
      queryClient.invalidateQueries({
        queryKey: NUDGE_QUERY_KEYS.remindCooldown({ userId: variables.receiverId }),
      });
      toast.success(t('todo:toast.remindNudgeSent'));
      trackEvent('remind_nudge_sent');
    },
    onError: (error) => {
      notifyError();

      if (isApiError(error) || isTodoNudgeError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.retryLater') });
    },
  });
};
