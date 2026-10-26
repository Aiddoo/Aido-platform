import { RemindNudgeBottomSheet } from '@src/features/nudge/components/nudge-bottom-sheet';
import { remindNudgeRouteParamsSchema } from '@src/features/nudge/hooks/use-remind-nudge-route-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RemindNudgeSheetRoute() {
  const params = remindNudgeRouteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <RemindNudgeBottomSheet.Route />
    </SheetRouteScreen>
  );
}
