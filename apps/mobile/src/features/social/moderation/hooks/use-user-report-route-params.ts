import { useLocalSearchParams } from 'expo-router';

import { userReportRouteParamsSchema } from '../schemas/moderation-params.schema';
import type { UserReportTarget } from '../schemas/user-report.schema';

export function useUserReportRouteParams(): { target: UserReportTarget; displayName: string } {
  const { userId, name, targetType, targetId } =
    userReportRouteParamsSchema.parse(useLocalSearchParams());
  return { target: { targetUserId: userId, targetType, targetId }, displayName: name };
}
