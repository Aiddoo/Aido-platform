import { useTodoNudgeService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import type { SendNudgeInput } from '../../repositories/todo-nudge.repository';

export const sendTodoNudgeMutationOptions = () => {
  const todoNudgeService = useTodoNudgeService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: SendNudgeInput) => {
      const result = await todoNudgeService.sendNudge(input);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success('콕 찔렀어요!');
    },
    onError: (error) => {
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
    },
  });
};
