import { useLocalSearchParams } from 'expo-router';

import { type WhatsNewParams, whatsNewParamsSchema } from '../schemas/whats-new-params.schema';

export function useWhatsNewParams(): readonly [WhatsNewParams] {
  return [whatsNewParamsSchema.parse(useLocalSearchParams())] as const;
}
