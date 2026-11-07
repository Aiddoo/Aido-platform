import { useLocalSearchParams } from 'expo-router';

import { verifyEmailParamsSchema } from '../schemas/verify-email-params.schema';

export function useVerifyEmailParam() {
  return verifyEmailParamsSchema.parse(useLocalSearchParams()).email;
}
