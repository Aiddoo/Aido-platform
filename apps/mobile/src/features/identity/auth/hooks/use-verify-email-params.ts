import { useLocalSearchParams } from 'expo-router';

import { verifyEmailParamsSchema } from '../schemas/verify-email-params.schema';

export function useVerifyEmailParams() {
  return verifyEmailParamsSchema.parse(useLocalSearchParams());
}
