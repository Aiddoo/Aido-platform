import { useLocalSearchParams } from 'expo-router';

import { todoCategoryParamsSchema } from '../schemas/todo-category-params.schema';

export function useTodoCategoryParams() {
  return todoCategoryParamsSchema.parse(useLocalSearchParams());
}
