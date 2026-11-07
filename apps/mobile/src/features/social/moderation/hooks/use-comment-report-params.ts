import { useLocalSearchParams } from 'expo-router';

import { commentReportParamsSchema } from '../schemas/moderation-params.schema';

export function useCommentReportParams() {
  return commentReportParamsSchema.parse(useLocalSearchParams());
}
