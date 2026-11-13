import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today';

import { todoSheetDateParamsSchema } from '../schemas/todo-params.schema';
import { toFeedDateKey } from '../utils/feed-date.view-model';

/** 시트가 할 일을 읽어 올 목록 날짜(YYYY-MM-DD). 없거나 잘못되면 오늘이다. */
export function useTodoSheetDateKey() {
  const [{ date }] = useRouteParams(todoSheetDateParamsSchema);
  const todayKey = useTodayKey();

  return [toFeedDateKey(date, todayKey)] as const;
}
