import { useLocalSearchParams } from 'expo-router';

import { todoScreenParamsSchema } from '../schemas/todo-params.schema';

export function useTodoScreenParams() {
  return todoScreenParamsSchema.parse(useLocalSearchParams());
}
