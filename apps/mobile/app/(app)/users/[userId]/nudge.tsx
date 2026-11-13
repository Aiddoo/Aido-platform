import { RemindNudgeBottomSheet } from '@src/features/social/nudge/components/nudge-bottom-sheet';
import { remindNudgeParamsSchema } from '@src/features/social/nudge/schemas/nudge-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function RemindNudgeSheetRoute() {
  const route = useRouteParamsOrRedirect(remindNudgeParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <RemindNudgeBottomSheet.Route />
    </SheetRouteScreen>
  );
}
