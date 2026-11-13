import { CategoryEditBottomSheet } from '@src/features/planning/category/components/category-edit-bottom-sheet';
import { todoCategoryParamsSchema } from '@src/features/planning/category/schemas/todo-category-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCategoryEditSheetRoute() {
  const route = useRouteParamsOrRedirect(todoCategoryParamsSchema, {
    fallbackHref: '/settings/category-settings',
  });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <CategoryEditBottomSheet />
    </SheetRouteScreen>
  );
}
