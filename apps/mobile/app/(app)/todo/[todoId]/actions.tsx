import { TodoActionsBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-actions-bottom-sheet';
import { todoScreenParamsSchema } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoActionsSheetRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
