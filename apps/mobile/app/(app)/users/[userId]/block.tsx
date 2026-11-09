import { BlockUserConfirmDialog } from '@src/features/social/moderation/components/block-user-confirm-dialog';
import { blockUserParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function BlockUserConfirmRoute() {
  const params = blockUserParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <BlockUserConfirmDialog />
    </SheetRouteScreen>
  );
}
