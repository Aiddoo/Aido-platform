import { ReportReasonBottomSheet } from '@src/features/moderation/components/report-reason-bottom-sheet';
import {
  userReportRouteParamsSchema,
  useUserReportRouteParams,
} from '@src/features/moderation/hooks/use-user-report-route-params';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function UserReportSheetRoute() {
  const params = userReportRouteParamsSchema.safeParse(useLocalSearchParams());

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
  const { target, displayName } = useUserReportRouteParams();

  return <ReportReasonBottomSheet target={target} targetDisplayName={displayName} />;
}
