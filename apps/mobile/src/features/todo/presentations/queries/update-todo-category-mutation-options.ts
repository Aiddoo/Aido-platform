import type { UpdateTodoCategoryInput } from '@aido/validators';
import { useTodoCategoryService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys.constant';

interface UpdateTodoCategoryParams {
  id: number;
  input: UpdateTodoCategoryInput;
}

export const updateTodoCategoryMutationOptions = () => {
  const todoCategoryService = useTodoCategoryService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async ({ id, input }: UpdateTodoCategoryParams) => {
      const result = await todoCategoryService.updateCategory(id, input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
    },
  });
};
