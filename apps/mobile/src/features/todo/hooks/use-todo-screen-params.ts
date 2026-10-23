import { todoDetailsParamSchema } from '@aido/api';
import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

export const todoScreenParamsSchema = z.object({
  todoId: routeIntegerStringSchema.pipe(todoDetailsParamSchema.shape.todoId),
});

export function useTodoScreenParams() {
  return todoScreenParamsSchema.parse(useRouteSearchParams());
}
