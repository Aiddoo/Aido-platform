import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { subTodoParamsSchema, todoParamsSchema } from '../schemas/todo-params.schema';

/** `/todo/[todoId]` 경로의 할 일. 화면의 정체성이라 바꾸지 않는다. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useTodoId() {
  const [{ todoId }] = useRouteParams(todoParamsSchema);

  return [todoId] as const;
}

export function useSubTodoId() {
  const [{ subTodoId }] = useRouteParams(subTodoParamsSchema);

  return [subTodoId] as const;
}
