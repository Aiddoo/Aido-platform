import { AddSubTodoBottomSheet } from '@src/features/todo/components/add-sub-todo-bottom-sheet';
import { subTodoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoEditSheetRoute() {
  const params = subTodoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <AddSubTodoBottomSheet mode="edit" />
    </SheetRouteScreen>
  );
}
