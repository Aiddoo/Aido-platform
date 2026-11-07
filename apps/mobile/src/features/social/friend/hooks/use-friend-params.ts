import { useLocalSearchParams } from 'expo-router';

import { friendParamsSchema } from '../schemas/friend-params.schema';

export function useFriendParams() {
  return friendParamsSchema.parse(useLocalSearchParams());
}
