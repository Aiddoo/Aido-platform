import { TodoDateBottomSheet } from '@src/features/todo/components/todo-list/todo-date-bottom-sheet';
import { todoSheetParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoDateSheetRoute() {
  const params = todoSheetParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoDateBottomSheet />
    </SheetRouteScreen>
  );
}
