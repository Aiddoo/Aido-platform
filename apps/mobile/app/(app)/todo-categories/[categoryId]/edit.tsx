import { CategoryEditBottomSheet } from '@src/features/planning/category/components/category-edit-bottom-sheet';
import { todoCategoryScreenParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
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
