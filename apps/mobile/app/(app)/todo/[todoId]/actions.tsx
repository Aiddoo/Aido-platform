import { TodoActionsBottomSheet } from '@src/features/todo/components/todo-list/todo-actions-bottom-sheet';
import { todoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoActionsSheetRoute() {
  const params = todoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
