import { verifyEmailSchema } from '@aido/validators';
import { useLocalSearchParams } from 'expo-router';

export const verifyEmailScreenParamsSchema = verifyEmailSchema.pick({ email: true });

export function useVerifyEmailScreenParams() {
  return verifyEmailScreenParamsSchema.parse(useLocalSearchParams());
}
