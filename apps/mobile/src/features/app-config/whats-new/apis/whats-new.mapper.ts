import type { FeatureDiscoveryResponse } from '@aido/api';

import type { WhatsNewConfig } from '../domains/whats-new.model';

export const toWhatsNewConfig = (response: FeatureDiscoveryResponse): WhatsNewConfig => {
  if (!response.enabled) {
    return { enabled: false };
  }

  return {
    ...response,
    launchedAt: new Date(response.launchedAt),
  };
};
