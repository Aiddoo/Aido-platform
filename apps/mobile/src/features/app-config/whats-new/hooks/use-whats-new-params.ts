import { useLocalSearchParams } from 'expo-router';

import { whatsNewParamsSchema } from '../schemas/whats-new-params.schema';

export function useWhatsNewParams() {
  return whatsNewParamsSchema.parse(useLocalSearchParams());
}
