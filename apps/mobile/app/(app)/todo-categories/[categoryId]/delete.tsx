import { CategoryDeleteBottomSheet } from '@src/features/planning/category/components/category-delete-bottom-sheet';
import { todoCategoryParamsSchema } from '@src/features/planning/category/schemas/todo-category-params.schema';
import { QueryErrorBoundary, SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function TodoCategoryDeleteSheetRoute() {
  const params = todoCategoryParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/settings/category-settings" />;
  }

  return (
    <SheetRouteScreen>
      <QueryErrorBoundary fallback={CategoryDeleteBottomSheet.Error}>
        <Suspense fallback={<CategoryDeleteBottomSheet.Loading />}>
          <CategoryDeleteBottomSheet />
        </Suspense>
      </QueryErrorBoundary>
    </SheetRouteScreen>
  );
}
