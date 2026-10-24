import { TodoCreateBottomSheet } from '@src/features/todo/components/todo-create-bottom-sheet';
import { todoCreateParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoCreateSheetRoute() {
  const params = todoCreateParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoCreateBottomSheet />
    </SheetRouteScreen>
  );
}
