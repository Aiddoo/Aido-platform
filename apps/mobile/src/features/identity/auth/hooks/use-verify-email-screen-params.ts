import { useLocalSearchParams } from 'expo-router';

import { verifyEmailScreenParamsSchema } from '../schemas/verify-email-params.schema';

export function useVerifyEmailScreenParams() {
  return verifyEmailScreenParamsSchema.parse(useLocalSearchParams());
}
