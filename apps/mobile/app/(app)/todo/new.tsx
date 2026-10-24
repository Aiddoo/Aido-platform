import { TodoCreateBottomSheet } from '@src/features/todo/components/todo-create-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCreateSheetRoute() {
  return (
    <SheetRouteScreen>
      <TodoCreateBottomSheet />
    </SheetRouteScreen>
  );
}
