import { SubTodoActionsBottomSheet } from '@src/features/todo/components/sub-todo-list/sub-todo-actions-bottom-sheet';
import { subTodoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoActionsSheetRoute() {
  const params = subTodoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <SubTodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
