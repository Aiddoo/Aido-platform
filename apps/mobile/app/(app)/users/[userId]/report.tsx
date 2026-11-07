import { ReportReasonBottomSheet } from '@src/features/social/moderation/components/report-reason-bottom-sheet';
import { userReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
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
  const [{ userId, name, targetType, targetId }] = useRouteParams(userReportParamsSchema);

  return (
    <ReportReasonBottomSheet
      target={{ targetUserId: userId, targetType, targetId }}
      targetDisplayName={name}
    />
  );
}
