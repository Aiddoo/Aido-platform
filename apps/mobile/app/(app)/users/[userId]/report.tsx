import { UserReportBottomSheet } from '@src/features/social/moderation/components/user-report-bottom-sheet';
import { userReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function UserReportSheetRoute() {
  const params = userReportParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <UserReportBottomSheet />
    </SheetRouteScreen>
  );
}
