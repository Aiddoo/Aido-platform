import { todoDetailsParamSchema } from '@aido/validators';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const todoScreenParamsSchema = z.object({
  todoId: routeIntegerStringSchema.pipe(todoDetailsParamSchema.shape.todoId),
});

export function useTodoScreenParams() {
  return todoScreenParamsSchema.parse(useLocalSearchParams());
}
