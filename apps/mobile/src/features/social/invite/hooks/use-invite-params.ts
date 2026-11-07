import { useLocalSearchParams } from 'expo-router';

import { inviteParamsSchema } from '../schemas/invite-params.schema';

export function useInviteParams() {
  return inviteParamsSchema.parse(useLocalSearchParams());
}
