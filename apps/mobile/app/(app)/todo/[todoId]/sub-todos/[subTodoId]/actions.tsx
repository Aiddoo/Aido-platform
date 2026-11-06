import { SubTodoActionsBottomSheet } from '@src/features/planning/todo/components/sub-todo-list/sub-todo-actions-bottom-sheet';
import { subTodoScreenParamsSchema } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoActionsSheetRoute() {
  const params = subTodoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <SubTodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
