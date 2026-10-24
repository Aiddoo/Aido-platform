import { useTodoCreateSheetParams } from '@src/features/todo/hooks/use-todo-sheet-params';
import { useSheetRoute } from '@src/shared/ui';
import { toDate } from '@src/shared/utils/date';

import { TODO_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { AddTodoBottomSheet } from './add-todo-bottom-sheet';

/** 할 일 추가 시트. 날짜와 카테고리는 `/todo/new` route의 search params에서 읽는다. */
export function TodoCreateBottomSheet() {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const { date, categoryId } = useTodoCreateSheetParams();

  return (
    <AddTodoBottomSheet
      mode="create"
      selectedDate={toDate(date)}
      categoryId={categoryId}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
      onExit={() => sheet.exit()}
    />
  );
}
