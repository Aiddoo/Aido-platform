import { TodoCategoryBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-category-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoCategorySheetRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <TodoCategoryBottomSheet />
    </SheetRouteScreen>
  );
}
