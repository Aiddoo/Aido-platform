import { TodoTimeBottomSheet } from '@src/features/todo/components/todo-list/todo-time-bottom-sheet';
import { todoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoTimeSheetRoute() {
  const params = todoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoTimeBottomSheet />
    </SheetRouteScreen>
  );
}
