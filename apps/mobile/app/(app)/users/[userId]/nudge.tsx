import { RemindNudgeBottomSheet } from '@src/features/social/nudge/components/nudge-bottom-sheet';
import { remindNudgeParamsSchema } from '@src/features/social/nudge/schemas/nudge-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RemindNudgeSheetRoute() {
  const params = remindNudgeParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <RemindNudgeBottomSheet.Route />
    </SheetRouteScreen>
  );
}
