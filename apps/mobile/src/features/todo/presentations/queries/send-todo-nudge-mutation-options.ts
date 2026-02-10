import { useTodoNudgeService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';
import type { SendNudgeInput } from '../../repositories/todo-nudge.repository';

export const sendTodoNudgeMutationOptions = () => {
  const todoNudgeService = useTodoNudgeService();

  return mutationOptions({
    mutationFn: async (input: SendNudgeInput) => {
      const result = await todoNudgeService.sendNudge(input);
      return unwrap(result);
    },
  });
};
