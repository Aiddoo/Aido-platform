import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { todoCategoryParamsSchema } from '../schemas/todo-category-params.schema';

/** `/todo-categories/[categoryId]` 시트 route의 카테고리. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useTodoCategoryId() {
  const [{ categoryId }] = useRouteParams(todoCategoryParamsSchema);

  return [categoryId] as const;
}
