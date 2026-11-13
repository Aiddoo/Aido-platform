import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { NudgeThanksBottomSheet } from '@src/features/social/nudge/components/nudge-thanks-bottom-sheet';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoThanksSheetRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <NudgeThanksBottomSheet />
    </SheetRouteScreen>
  );
}
