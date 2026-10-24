import { CategoryEditBottomSheet } from '@src/features/todo/components/category-edit-bottom-sheet';
import { todoCategoryScreenParamsSchema } from '@src/features/todo/hooks/use-todo-sheet-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoCategoryEditSheetRoute() {
  const params = todoCategoryScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/settings/category-settings" />;
  }

  return (
    <SheetRouteScreen>
      <CategoryEditBottomSheet />
    </SheetRouteScreen>
  );
}
