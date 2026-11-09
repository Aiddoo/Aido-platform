import { SubTodoActionsBottomSheet } from '@src/features/planning/todo/components/sub-todo-list/sub-todo-actions-bottom-sheet';
import { subTodoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoActionsSheetRoute() {
  const params = subTodoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <SubTodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
