import { useLocalSearchParams } from 'expo-router';

import type { UserReportTarget } from '../domains/user-report.model';
import { userReportRouteParamsSchema } from '../schemas/moderation-params.schema';

export function useUserReportRouteParams(): { target: UserReportTarget; displayName: string } {
  const { userId, name, targetType, targetId } =
    userReportRouteParamsSchema.parse(useLocalSearchParams());
  return { target: { targetUserId: userId, targetType, targetId }, displayName: name };
}
