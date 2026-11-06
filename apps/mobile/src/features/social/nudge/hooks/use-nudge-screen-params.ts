import { useLocalSearchParams } from 'expo-router';

import { nudgeScreenParamsSchema } from '../schemas/nudge-params.schema';

export function useNudgeScreenParams() {
  return nudgeScreenParamsSchema.parse(useLocalSearchParams());
}
