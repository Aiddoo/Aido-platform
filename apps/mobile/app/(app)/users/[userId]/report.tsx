import { ReportReasonBottomSheet } from '@src/features/social/moderation/components/report-reason-bottom-sheet';
import { userReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** 프로필·콕·응원 메시지는 연 화면이 대상과 이름을 모두 알아 route 값만으로 그린다 */
export default function UserReportSheetScreen() {
  const params = userReportParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  const { userId, name, targetType, targetId } = params.data;

  return (
    <SheetRouteScreen>
      <ReportReasonBottomSheet
        target={{ targetUserId: userId, targetType, targetId }}
        targetDisplayName={name}
      />
    </SheetRouteScreen>
  );
}
