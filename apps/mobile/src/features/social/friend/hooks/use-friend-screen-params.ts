import { useLocalSearchParams } from 'expo-router';

import { friendScreenParamsSchema } from '../schemas/friend-params.schema';

export function useFriendScreenParams() {
  return friendScreenParamsSchema.parse(useLocalSearchParams());
}
