import { AddSubTodoBottomSheet } from '@src/features/planning/composer/components/add-sub-todo-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SubTodoCreateSheetRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <AddSubTodoBottomSheet mode="create" />
    </SheetRouteScreen>
  );
}
