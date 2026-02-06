import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const parseTodoMutationOptions = () => {
  const todoService = useTodoService();

  return mutationOptions({
    mutationFn: async (text: string) => {
      const result = await todoService.parseTodo(text);
      return unwrap(result);
    },
  });
};
