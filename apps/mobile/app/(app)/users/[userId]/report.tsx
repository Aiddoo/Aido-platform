import { UserReportBottomSheet } from '@src/features/social/moderation/components/user-report-bottom-sheet';
import { userReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function UserReportSheetRoute() {
  const route = useRouteParamsOrRedirect(userReportParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <UserReportBottomSheet />
    </SheetRouteScreen>
  );
}
