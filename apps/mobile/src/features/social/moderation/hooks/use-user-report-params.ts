import { useLocalSearchParams } from 'expo-router';

import { userReportParamsSchema } from '../schemas/moderation-params.schema';
import type { UserReportTarget } from '../schemas/user-report.schema';

export function useUserReportParams(): { target: UserReportTarget; displayName: string } {
  const { userId, name, targetType, targetId } =
    userReportParamsSchema.parse(useLocalSearchParams());
  return { target: { targetUserId: userId, targetType, targetId }, displayName: name };
}
