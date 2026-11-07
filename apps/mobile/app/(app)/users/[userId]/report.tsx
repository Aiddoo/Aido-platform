import { ReportReasonBottomSheet } from '@src/features/social/moderation/components/report-reason-bottom-sheet';
import { useUserReportParams } from '@src/features/social/moderation/hooks/use-user-report-params';
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
      <UserReportSheet />
    </SheetRouteScreen>
  );
}

/** 프로필·콕·응원 메시지는 연 화면이 대상과 이름을 모두 알아 route 값만으로 그린다 */
function UserReportSheet() {
  const { target, displayName } = useUserReportParams();

  return <ReportReasonBottomSheet target={target} targetDisplayName={displayName} />;
}
