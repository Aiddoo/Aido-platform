import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const parseTodoMutationOptions = () => {
  const todoService = useTodoService();

  return mutationOptions({
    mutationFn: (text: string) => todoService.parseTodo(text),
  });
};
