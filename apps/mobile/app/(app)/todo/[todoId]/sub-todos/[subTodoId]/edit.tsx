import { EditSubTodoBottomSheet } from '@src/features/planning/composer/components/edit-sub-todo-bottom-sheet';
import { subTodoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function SubTodoEditSheetRoute() {
  const route = useRouteParamsOrRedirect(subTodoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <EditSubTodoBottomSheet />
    </SheetRouteScreen>
  );
}
