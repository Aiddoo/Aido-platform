import { TodoActionsBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-actions-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { TodoThanksSummary } from '@src/features/social/nudge/components/todo-thanks-summary';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoActionsSheetRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <TodoActionsBottomSheet summary={TodoThanksSummary} />
    </SheetRouteScreen>
  );
}
