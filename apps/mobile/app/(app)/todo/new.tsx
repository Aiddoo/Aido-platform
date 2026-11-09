import { useRefreshMemos } from '@src/features/notes/memo/hooks/use-refresh-memos';
import { TodoCreateBottomSheet } from '@src/features/planning/composer/components/todo-create-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCreateSheetRoute() {
  const refreshMemos = useRefreshMemos();

  return (
    <SheetRouteScreen>
      <TodoCreateBottomSheet onMemoChanged={refreshMemos} />
    </SheetRouteScreen>
  );
}
