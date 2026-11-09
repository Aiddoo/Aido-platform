import { TodoEditBottomSheet } from '@src/features/planning/composer/components/todo-edit-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoEditSheetRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoEditBottomSheet />
    </SheetRouteScreen>
  );
}
