import { CategoryDeleteBottomSheet } from '@src/features/planning/category/components/category-delete-bottom-sheet';
import { todoCategoryParamsSchema } from '@src/features/planning/category/schemas/todo-category-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { QueryErrorBoundary, SheetRouteScreen } from '@src/shared/ui';
import { Suspense } from 'react';

export default function TodoCategoryDeleteSheetRoute() {
  const route = useRouteParamsOrRedirect(todoCategoryParamsSchema, {
    fallbackHref: '/settings/category-settings',
  });

  if (route.redirect != null) {
    return route.redirect;
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
