import type { FeatureDiscoveryResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type { WhatsNewConfig } from '../schemas/whats-new.schema';

export const toWhatsNewConfig = (response: FeatureDiscoveryResponse): WhatsNewConfig => {
  if (!response.enabled) {
    return { enabled: false };
  }

  return {
    ...response,
    launchedAt: toInstant(response.launchedAt),
  };
};
