import { useLocalSearchParams } from 'expo-router';

import { todoParamsSchema } from '../schemas/todo-params.schema';

export function useTodoParams() {
  return todoParamsSchema.parse(useLocalSearchParams());
}
