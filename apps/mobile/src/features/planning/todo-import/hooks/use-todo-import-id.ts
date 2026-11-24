import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { todoImportParamsSchema } from '../schemas/todo-import-params.schema';

/** `/todo-import/[importId]`의 가져오기. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useTodoImportId() {
  const [{ importId }] = useRouteParams(todoImportParamsSchema);

  return [importId] as const;
}
