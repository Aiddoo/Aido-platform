import { userIdParamSchema } from '@aido/api';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const friendScreenParamsSchema = z.object({
  friendId: userIdParamSchema.shape.userId,
});

export function useFriendScreenParams() {
  return friendScreenParamsSchema.parse(useLocalSearchParams());
}
