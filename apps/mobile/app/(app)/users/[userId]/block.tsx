import { BlockUserConfirmDialog } from '@src/features/social/moderation/components/block-user-confirm-dialog';
import { blockUserParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function BlockUserConfirmRoute() {
  const route = useRouteParamsOrRedirect(blockUserParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <BlockUserConfirmDialog />
    </SheetRouteScreen>
  );
}
