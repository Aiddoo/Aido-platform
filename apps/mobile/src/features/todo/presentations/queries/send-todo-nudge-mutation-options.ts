import { useTodoNudgeService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { isTodoNudgeError } from '../../models/todo-nudge.error';
import type { SendNudgeInput } from '../../repositories/todo-nudge.repository';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const sendTodoNudgeMutationOptions = () => {
  const todoNudgeService = useTodoNudgeService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: SendNudgeInput) => {
      const result = await todoNudgeService.sendNudge(input);
      return unwrap(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.nudgeLimit() });
      queryClient.invalidateQueries({
        queryKey: TODO_QUERY_KEYS.nudgeCooldown(variables.receiverId),
      });
      toast.success('콕 찔렀어요!');
    },
    onError: (error) => {
      if (isApiError(error) || isTodoNudgeError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
    },
  });
};
