import { AddSubTodoBottomSheet } from '@src/features/planning/composer/components/add-sub-todo-bottom-sheet';
import { subTodoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoEditSheetRoute() {
  const params = subTodoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <AddSubTodoBottomSheet mode="edit" />
    </SheetRouteScreen>
  );
}
