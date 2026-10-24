import { TodoEditBottomSheet } from '@src/features/todo/components/todo-edit-bottom-sheet';
import { todoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoEditSheetRoute() {
  const params = todoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoEditBottomSheet />
    </SheetRouteScreen>
  );
}
