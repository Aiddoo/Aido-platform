import { useLocalSearchParams } from 'expo-router';

import { commentReportRouteParamsSchema } from '../schemas/moderation-params.schema';

export function useCommentReportRouteParams() {
  return commentReportRouteParamsSchema.parse(useLocalSearchParams());
}
