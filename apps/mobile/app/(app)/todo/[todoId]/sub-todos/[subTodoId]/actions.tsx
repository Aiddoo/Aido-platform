import { SubTodoActionsBottomSheet } from '@src/features/planning/todo/components/sub-todo-actions-bottom-sheet';
import { subTodoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function SubTodoActionsSheetRoute() {
  const route = useRouteParamsOrRedirect(subTodoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <SubTodoActionsBottomSheet />
    </SheetRouteScreen>
  );
}
