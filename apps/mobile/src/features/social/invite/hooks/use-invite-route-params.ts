import { useLocalSearchParams } from 'expo-router';

import { inviteRouteParamsSchema } from '../schemas/invite-params.schema';

export function useInviteRouteParams() {
  return inviteRouteParamsSchema.parse(useLocalSearchParams());
}
