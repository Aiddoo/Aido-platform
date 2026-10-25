import { AddSubTodoBottomSheet } from '@src/features/todo/components/add-sub-todo-bottom-sheet';
import { todoScreenParamsSchema } from '@src/features/todo/hooks/use-todo-screen-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoCreateSheetRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <AddSubTodoBottomSheet mode="create" />
    </SheetRouteScreen>
  );
}
