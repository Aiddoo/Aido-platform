import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today-key';

import { toFeedDateKey } from '../schemas/feed-params.schema';
import { todoParamsSchema, todoSheetDateParamsSchema } from '../schemas/todo-params.schema';

/** `/todo/[todoId]` 경로의 할 일. 화면의 정체성이라 바꾸지 않는다. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useTodoId() {
  const [{ todoId }] = useRouteParams(todoParamsSchema);

  return [todoId] as const;
}

/** 시트가 할 일을 읽어 올 목록 날짜(YYYY-MM-DD). 없거나 잘못되면 오늘이다. */
export function useTodoSheetDateKey() {
  const [{ date }] = useRouteParams(todoSheetDateParamsSchema);
  const todayKey = useTodayKey();

  return [toFeedDateKey(date, todayKey)] as const;
}
