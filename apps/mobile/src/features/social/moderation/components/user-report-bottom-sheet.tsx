import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { userReportParamsSchema } from '../schemas/moderation-params.schema';
import { ReportReasonBottomSheet } from './report-reason-bottom-sheet';

/** 프로필·콕·응원 메시지는 연 화면이 대상과 이름을 모두 알아 route 값만으로 그린다 */
export function UserReportBottomSheet() {
  const [{ userId, name, targetType, targetId }] = useRouteParams(userReportParamsSchema);

  return (
    <ReportReasonBottomSheet
      target={{ targetUserId: userId, targetType, targetId }}
      targetDisplayName={name}
    />
  );
}
