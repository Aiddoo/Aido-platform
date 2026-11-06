import { TodoDateBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-date-bottom-sheet';
import { todoScreenParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoDateSheetRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoDateBottomSheet />
    </SheetRouteScreen>
  );
}
