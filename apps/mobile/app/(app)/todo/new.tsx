import { TodoCreateBottomSheet } from '@src/features/planning/composer/components/todo-create-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCreateSheetRoute() {
  return (
    <SheetRouteScreen>
      <TodoCreateBottomSheet />
    </SheetRouteScreen>
  );
}
